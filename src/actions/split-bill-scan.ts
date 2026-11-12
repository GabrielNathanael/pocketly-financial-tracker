"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CURRENCY_CODES, DEFAULT_CURRENCY } from "@/lib/constants/currencies";
import { callGeminiJson } from "@/lib/ocr/gemini";

const SUPPORTED_CURRENCIES = new Set<string>(CURRENCY_CODES);

export interface SplitBillScanItem {
  name: string;
  quantity: number;
  unit_price: number;
  line_subtotal: number;
  /** Nilai diskon per baris: nominal (fixed) atau persen (percent). */
  item_discount?: number;
  item_discount_mode?: "percent" | "fixed";
}

export interface SplitBillScanCharge {
  name: string;
  kind: "tax" | "service" | "discount" | "other";
  amount_mode: "percent" | "fixed";
  amount_value: number;
}

export interface SplitBillScanResult {
  merchant: string;
  date?: string;
  currency?: string;
  subtotal: number;
  grand_total: number;
  items: SplitBillScanItem[];
  charges: SplitBillScanCharge[];
  rawText: string;
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Scan struk buat Split Bill pakai Gemini Vision.
 * Hasilnya: merchant, tanggal, item (qty + harga satuan + subtotal + diskon per baris),
 * dan biaya tambahan (pajak / service / diskon) baik persen maupun nominal.
 */
export async function scanReceiptForSplitBill(formData: FormData): Promise<SplitBillScanResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const file = formData.get("file");
  const mimeType = String(formData.get("mimeType") || "image/jpeg");
  if (!(file instanceof Blob)) throw new Error("Gagal memproses gambar struk");

  const currencyInput = String(formData.get("currency") || DEFAULT_CURRENCY).toUpperCase();
  const currency = SUPPORTED_CURRENCIES.has(currencyInput) ? currencyInput : DEFAULT_CURRENCY;

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const prompt = `Kamu adalah OCR struk belanja untuk aplikasi patungan (split bill). Baca foto struk ini dan kembalikan HANYA JSON valid (tanpa markdown) dengan struktur:
{
  "merchant": "nama toko string",
  "date": "yyyy-mm-dd atau null",
  "currency": "IDR",
  "subtotal": 141000,
  "grand_total": 162150,
  "items": [
    { "name": "Nasi Goreng Spesial", "quantity": 2, "unit_price": 35000, "line_subtotal": 70000, "item_discount": 0, "item_discount_mode": "fixed" }
  ],
  "charges": [
    { "name": "Service", "kind": "service", "amount_mode": "percent", "amount_value": 5 },
    { "name": "PB1", "kind": "tax", "amount_mode": "percent", "amount_value": 10 }
  ]
}

Konteks:
- Mata uang transaksi: ${currency} (kode ISO). Utamakan nilai/format yang benar-benar tercetak di struk.
- Struk bisa jadi lebih dari 1 halaman, dan bisa berupa struk toko, restoran, cafe, minimarket, atau marketplace.

Aturan item:
- items = SEMUA barang/baris yang tercetak di struk, apa adanya (jangan gabung, jangan buang).
- name = nama barang apa yang tertulis (maksimal 80 karakter).
- quantity = jumlah yang tertulis (angka). Boleh desimal untuk timbang/kiloan (mis. 0.414). Kalau tidak ada kolom qty, pakai 1.
- unit_price = harga SATUAN persis dari kolom harga satuan. Kalau tidak ada kolom harga satuan, pakai angka harga yang tercetak.
- line_subtotal = angka kolom paling kanan per baris (total baris yang tercetak). SALIN PERSIS, jangan hitung ulang. Kalau tidak ada, pakai unit_price x quantity.
- item_discount = nilai diskon yang tercetak di baris itu. 0 kalau tidak ada diskon per baris. Jangan mengarang diskon.
- item_discount_mode = "percent" jika diskon baris tertulis sebagai persen (mis. "10%"), "fixed" jika nominal/angka uang. Jika tidak ada diskon, pakai "fixed".

Aturan biaya (charges):
- charges = pajak / service charge / diskon_struct / biaya lain yang tercetak sebagai baris terpisah di bagian bawah struk.
- name = label yang tercetak (mis. "PPN 11%", "PB1", "Service Charge", "Discount").
- kind = salah satu dari: "tax" (pajak), "service" (biaya layanan/restaurant), "discount" (potongan/diskon), "other".
- amount_mode = "percent" kalau tertulis sebagai persen (mis. "10%") dan "fixed" kalau nominal rupiah (mis. "Rp 7.050").
- amount_value = angkanya apa adanya (10 untuk 10%, 7050 untuk Rp 7.050).
- Kalau tidak ada biaya sama sekali, array charges kosong.

Aturan total:
- subtotal = total barang SEBELUM pajak/service (kalau tercetak, pakai yang tercetak; kalau tidak, jumlahkan line_subtotal - item_discount).
- grand_total = TOTAL yang dibayar (bukan kembalian). Pakai angka yang tercetak.

Format angka:
- Kembalikan semua angka sebagai number (bukan string).
- Jangan memaksakan pembulatan; pakai desimal kalau memang tercetak (mis. 12.34).
- Baca pemisah ribuan/desimal sesuai yang tercetak.
- Jangan tambah teks lain di luar JSON.`;

  const { data, rawText } = await callGeminiJson({
    prompt,
    imageBase64: base64,
    mimeType,
    maxOutputTokens: 8192,
  });

  const parsed = data as {
    merchant?: string;
    date?: string | null;
    currency?: string;
    subtotal?: number;
    grand_total?: number;
    items?: {
      name?: string;
      quantity?: number;
      unit_price?: number;
      line_subtotal?: number;
      item_discount?: number;
      item_discount_mode?: string;
    }[];
    charges?: {
      name?: string;
      kind?: string;
      amount_mode?: string;
      amount_value?: number;
    }[];
  };

  const items: SplitBillScanItem[] = (Array.isArray(parsed.items) ? parsed.items : [])
    .map((it) => {
      const name = String(it?.name || "").trim().slice(0, 80);
      const quantity = num(it?.quantity, 1) > 0 ? num(it?.quantity, 1) : 1;
      const unitPrice = Math.max(0, num(it?.unit_price, 0));
      const lineSubtotal = Math.max(0, num(it?.line_subtotal, unitPrice * quantity));
      const itemDiscountMode: "percent" | "fixed" = it?.item_discount_mode === "percent" ? "percent" : "fixed";
      const rawDiscount = num(it?.item_discount, 0);
      const itemDiscount = itemDiscountMode === "percent"
        ? Math.min(Math.max(rawDiscount, 0), 100)
        : Math.min(Math.max(rawDiscount, 0), lineSubtotal);
      return {
        name,
        quantity,
        unit_price: unitPrice,
        line_subtotal: lineSubtotal,
        item_discount: itemDiscount,
        item_discount_mode: itemDiscountMode,
      };
    })
    .filter((it) => it.name.length > 0);

  const allowedKinds = new Set(["tax", "service", "discount", "other"]);
  const charges: SplitBillScanCharge[] = (Array.isArray(parsed.charges) ? parsed.charges : [])
    .map((c) => {
      const kind = allowedKinds.has(String(c?.kind)) ? (String(c.kind) as SplitBillScanCharge["kind"]) : "other";
      const amountMode: SplitBillScanCharge["amount_mode"] = c?.amount_mode === "fixed" ? "fixed" : "percent";
      const rawValue = num(c?.amount_value, 0);
      const amountValue = amountMode === "percent" ? Math.min(Math.max(rawValue, 0), 100) : Math.max(rawValue, 0);
      return {
        name: String(c?.name || (kind === "tax" ? "Tax" : kind === "service" ? "Service" : "Discount")).slice(0, 100),
        kind,
        amount_mode: amountMode,
        amount_value: amountValue,
      };
    })
    .filter((c) => c.amount_value > 0);

  const itemsSubtotal = items.reduce((s, i) => {
    const disc = i.item_discount_mode === "percent"
      ? (i.line_subtotal * Math.min(Math.max(i.item_discount || 0, 0), 100)) / 100
      : Math.min(Math.max(i.item_discount || 0, 0), i.line_subtotal);
    return s + Math.max(0, i.line_subtotal - disc);
  }, 0);
  const subtotal = num(parsed.subtotal, 0) > 0 ? num(parsed.subtotal, 0) : Math.round(itemsSubtotal * 100) / 100;

  const chargesTotal = charges.reduce((s, c) => {
    if (c.amount_mode === "percent") return s + (subtotal * c.amount_value) / 100;
    return s + c.amount_value;
  }, 0);
  const computedGrand = Math.round((subtotal + chargesTotal) * 100) / 100;
  const grandTotal = num(parsed.grand_total, 0) > 0 ? num(parsed.grand_total, 0) : computedGrand;

  const date =
    parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date)) ? String(parsed.date) : undefined;

  // Nggak ada barang yang kebaca -> error (jangan bikin patungan kosong).
  if (items.length === 0) {
    throw new Error(
      "Tidak ada item yang terbaca dari struk ini. Pastikan foto struk jelas.",
    );
  }

  const modelCurrency = String(parsed.currency || "").toUpperCase();
  const finalCurrency = SUPPORTED_CURRENCIES.has(modelCurrency) ? modelCurrency : currency;

  return {
    merchant: String(parsed.merchant || "Struk Belanja").slice(0, 120),
    date,
    currency: finalCurrency,
    subtotal,
    grand_total: grandTotal,
    items,
    charges,
    rawText,
  };
}
