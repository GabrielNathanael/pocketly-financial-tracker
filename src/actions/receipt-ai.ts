"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ParsedReceipt } from "@/lib/ocr/receipt-scanner";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getGeminiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  );
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export async function scanReceiptWithGemini(
  base64: string,
  mimeType: string,
): Promise<ParsedReceipt> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY belum diatur di .env.local");

  const prompt = `Kamu adalah OCR struk belanja Indonesia. Baca foto struk ini dan kembalikan HANYA JSON valid (tanpa markdown) dengan struktur:
{
  "merchant": "nama toko string",
  "date": "yyyy-mm-dd atau null",
  "total": 86500,
  "items": [{"name": "nama item", "quantity": 2, "price": 12500}]
}

Aturan:
- total adalah TOTAL BELANJA (yang dibayar, bukan kembalian).
- items adalah semua barang yang terbaca di struk, harga per item dalam Rupiah (angka saja, tanpa titik/koma).
- quantity adalah jumlah bungkus/item (angka, 1 kalau tidak tercantum, boleh desimal seperti 0.5).
- price adalah harga SATUAN per bungkus, bukan subtotal.
- Jika item tidak terbaca, kosongkan array items.
- Harga dan total harus angka bulat (contoh: 12500 bukan "Rp12.500").
- Jangan tambah teks lain di luar JSON.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini error ${res.status}: ${txt.slice(0, 300)}`);
  }

  const json = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
    "";
  if (!text) throw new Error("Gemini mengembalikan kosong");

  let parsed: { merchant?: string; date?: string | null; total?: number; items?: { name: string; quantity?: number; price: number }[] };
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error("Respons Gemini bukan JSON");
  }

  const items = Array.isArray(parsed.items)
    ? parsed.items
        .filter((it) => it && typeof it.name === "string" && Number(it.price) > 0)
        .map((it) => ({
          name: String(it.name).slice(0, 80),
          quantity: String(Number(it.quantity) > 0 ? Number(it.quantity) : 1),
          price: String(Math.round(Number(it.price))),
        }))
    : [];

  const total = Number(parsed.total) || 0;
  const date =
    parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date))
      ? String(parsed.date)
      : undefined;

  return {
    amount: total,
    description: String(parsed.merchant || "Struk belanja").slice(0, 120),
    date,
    items,
    rawText: text,
  };
}
