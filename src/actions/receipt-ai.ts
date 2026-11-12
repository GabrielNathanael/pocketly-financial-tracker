"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ParsedReceipt } from "@/lib/ocr/receipt-scanner";
import { callGeminiJson } from "@/lib/ocr/gemini";

export async function scanReceiptWithGemini(
  formData: FormData,
): Promise<ParsedReceipt> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const file = formData.get("file");
  const mimeType = String(formData.get("mimeType") || "image/jpeg");
  const currency = String(formData.get("currency") || "IDR").toUpperCase();
  if (!(file instanceof Blob)) {
    throw new Error("Gagal memproses gambar struk");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const currencyCode = (currency || "IDR").toUpperCase();
  const prompt = `Kamu adalah OCR struk belanja. Baca foto struk ini dan kembalikan HANYA JSON valid (tanpa markdown) dengan struktur:
{
  "merchant": "nama toko string",
  "date": "yyyy-mm-dd atau null",
  "total": 140963,
  "items": [{"name": "KOL BEIJING", "quantity": 0.414, "price": 24900, "subtotal": 10309}]
}

Konteks:
- Mata uang transaksi: ${currencyCode} (kode ISO). Gunakan ini sebagai konteks, tapi utamakan nilai/format yang benar-benar tercetak di struk.

Aturan:
- total adalah TOTAL BELANJA (yang dibayar, bukan kembalian).
- items adalah semua barang yang terbaca di struk.
- quantity adalah jumlah bungkus/item/bobot (angka, 1 kalau tidak tercantum, boleh desimal seperti 0.5 untuk kiloan).
- price adalah harga SATUAN per bungkus/kilo persis tertulis di kolom harga satuan, bukan subtotal.
- subtotal adalah angka kolom paling kanan per baris. SALIN PERSIS angka yang tercetak di struk (sudah dibulatkan POS/merchant), JANGAN hitung ulang quantity x price.
- Jika baris cuma punya 1 angka harga (tidak ada kolom subtotal terpisah), isi subtotal dengan angka itu, jangan mengarang.
- Jika item tidak terbaca, kosongkan array items.
- total, price, subtotal kembalikan sebagai angka (number) dalam unit mata uang ${currencyCode}. Gunakan desimal jika tercetak/berlaku untuk mata uang tersebut (mis. 12.34), dan jangan memaksakan pembulatan ke bilangan bulat kecuali memang begitu di struk. Jangan batasi ke currency tertentu.
- Baca pemisah ribuan/desimal sesuai yang tercetak di struk (format bisa berbeda-beda).
- Jangan tambah teks lain di luar JSON.`;

  const { data, rawText } = await callGeminiJson({
    prompt,
    imageBase64: base64,
    mimeType,
  });

  const parsed = data as {
    merchant?: string;
    date?: string | null;
    total?: number;
    items?: {
      name: string;
      quantity?: number;
      price: number;
      subtotal?: number | null;
    }[];
  };

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter((it) => it && typeof it.name === "string" && Number(it.price) > 0)
        .map((it) => ({
          name: String(it.name).slice(0, 80),
          quantity: String(Number(it.quantity) > 0 ? Number(it.quantity) : 1),
          price: String(Number(it.price)),
          // Printed line total copied from the receipt. If the model
          // omitted it / returned null, leave it undefined so callers
          // fall back to quantity * price.
          ...(it.subtotal != null && Number(it.subtotal) > 0
            ? { subtotal: String(Number(it.subtotal)) }
            : {}),
        }))
    : [];

  const total = Number(parsed.total) || 0;
  const date =
    parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date))
      ? String(parsed.date)
      : undefined;

  const merchantRaw = String(parsed.merchant || "").trim();
  // Nggak ada yang kebaca sama sekali (mis. foto bukan struk) -> error, jangan
  // diam-diam bikin transaksi kosong.
  if (items.length === 0 && total <= 0 && !merchantRaw) {
    throw new Error(
      "Tidak ada data yang terbaca dari struk ini. Pastikan foto struk jelas.",
    );
  }

  return {
    amount: total,
    description: (merchantRaw || "Struk belanja").slice(0, 120),
    date,
    items,
    rawText,
  };
}
