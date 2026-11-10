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
  // Coba tangkap blok code fence json/plain
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]?.trim()) return fenced[1].trim();
  // Coba cari objek JSON pertama
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    // Buang karakter yang mungkin mengganggu
    return candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  }
  if (start >= 0) {
    // Respons mungkin terpotong (tanpa } penutup)
    return trimmed.slice(start).replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  }
  return trimmed.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}

function tryRepairTruncatedJson(input: string): string | null {
  let s = input.trim();
  // Coba potong ke batas item/string yang lebih mungkin utuh
  const lastObjectEnd = Math.max(s.lastIndexOf("},"), s.lastIndexOf("}"));
  if (lastObjectEnd > 0) {
    const cut = s.slice(0, lastObjectEnd + 1).replace(/,\s*$/, "");
    const candidates = [cut, s.replace(/,\s*$/, "")];
    for (const base of candidates) {
      let attempt = base;
      // Tutup string jika terpotong di tengah string
      const quoteCount = (attempt.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 === 1) attempt += '"';
      // Hapus trailing comma/gampang
      attempt = attempt.replace(/,\s*$/, "");
      const stack: string[] = [];
      let inString = false;
      let escape = false;
      for (const ch of attempt) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") stack.push("}");
        else if (ch === "[") stack.push("]");
        else if (ch === "}" || ch === "]") {
          if (stack.length && stack[stack.length - 1] === ch) stack.pop();
        }
      }
      if (inString) {
        // sudah ditutup di atas, tapi jaga-jaga
      }
      while (stack.length) attempt += stack.pop();
      attempt = attempt.replace(/,\s*([}\]])/g, "$1");
      try {
        JSON.parse(attempt);
        return attempt;
      } catch {
        // lanjut coba kandidat lain
      }
    }
  }
  // Fallback: coba tutup bracket/brace dari string asli
  let attempt = s.replace(/,\s*$/, "");
  const quoteCount = (attempt.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 === 1) attempt += '"';
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of attempt) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop();
    }
  }
  while (stack.length) attempt += stack.pop();
  attempt = attempt.replace(/,\s*([}\]])/g, "$1");
  try {
    JSON.parse(attempt);
    return attempt;
  } catch {
    return null;
  }
}

export async function scanReceiptWithGemini(
  formData: FormData,
): Promise<ParsedReceipt> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY belum diatur di .env.local");

  const file = formData.get("file");
  const mimeType = String(formData.get("mimeType") || "image/jpeg");
  const currency = String(formData.get("currency") || "IDR");
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

  const models = Array.from(
    new Set(
      [
        GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
      ].filter(
        (m): m is string =>
          Boolean(m) && !/gemini-(1\.|2\.0)/.test(m) && !/pro/i.test(m),
      ),
    ),
  );

  let lastError: Error | null = null;
  console.info("[receipt-ai] Trying Gemini models:", models.join(", "));

  for (const model of models) {
    try {
      console.info(`[receipt-ai] Attempting model: ${model}`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType || "image/jpeg",
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        const err = new Error(`Gemini error ${res.status} (${model}): ${txt.slice(0, 300)}`);
        lastError = err;
        console.warn(`[receipt-ai] Model failed: ${model} (status ${res.status})`, txt.slice(0, 300));
        // Coba model fallback lain untuk error sementara / model tidak tersedia
        if ([429, 500, 502, 503, 504, 404].includes(res.status)) {
          continue;
        }
        throw err;
      }

      const json = await res.json();
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || "")
          .join("") || "";
      if (!text) {
        console.warn(`[receipt-ai] Empty response from model: ${model}`);
        throw new Error(`Gemini (${model}) mengembalikan kosong`);
      }

      let parsed: {
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
      const rawJson = extractJson(text);
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        try {
          const sanitized = rawJson
            .replace(/,\s*([}\]])/g, "$1") // trailing commas
            .replace(/\r\n/g, "\n");
          parsed = JSON.parse(sanitized);
        } catch {
          const repaired = tryRepairTruncatedJson(rawJson);
          if (repaired) {
            try {
              parsed = JSON.parse(repaired);
              console.warn(`[receipt-ai] Repaired truncated JSON from ${model}`);
            } catch {
              console.warn(
                `[receipt-ai] Non-JSON response from ${model}:`,
                text.slice(0, 500),
              );
              throw new Error(`Respons Gemini (${model}) bukan JSON`);
            }
          } else {
            console.warn(
              `[receipt-ai] Non-JSON response from ${model}:`,
              text.slice(0, 500),
            );
            throw new Error(`Respons Gemini (${model}) bukan JSON`);
          }
        }
      }

      const items = Array.isArray(parsed.items)
        ? parsed.items
            .filter(
              (it) =>
                it && typeof it.name === "string" && Number(it.price) > 0,
            )
            .map((it) => ({
              name: String(it.name).slice(0, 80),
              quantity: String(
                Number(it.quantity) > 0 ? Number(it.quantity) : 1,
              ),
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

      console.info(`[receipt-ai] Model succeeded: ${model}`);
      return {
        amount: total,
        description: String(parsed.merchant || "Struk belanja").slice(0, 120),
        date,
        items,
        rawText: text,
      };
    } catch (err) {
      lastError = err as Error;
      const msg = String((err as Error)?.message || "");
      // Lanjut coba model berikutnya untuk gangguan sementara/rate limit/model issue
      // atau jika respons model tidak bisa dipakai (bukan JSON/kosong)
      if (
        /429|500|502|503|504|404|UNAVAILABLE|RESOURCE_EXHAUSTED|not found|bukan JSON|mengembalikan kosong/i.test(
          msg,
        )
      ) {
        console.warn(`[receipt-ai] Falling back from ${model}: ${msg}`);
        continue;
      }
      console.error(`[receipt-ai] Non-retryable error on ${model}:`, err);
      throw err;
    }
  }

  console.error("[receipt-ai] All Gemini models failed", lastError);
  throw lastError || new Error("Semua model Gemini gagal memproses struk");
}
