/**
 * Helper Gemini Vision (server-side).
 * Dipakai oleh:
 *  - src/actions/receipt-ai.ts      (Quick Add: scan struk)
 *  - src/actions/split-bill-scan.ts (Split Bill: scan struk patungan)
 *
 * Semua request langsung ke Google Generative Language API.
 * Model dicoba berurutan (fallback) kalau satu gagal / rate-limited.
 */

const DEFAULT_MODELS = [
  process.env.GEMINI_MODEL || "",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
].filter(
  (m): m is string =>
    Boolean(m) && !/gemini-(1\.|2\.0)/.test(m) && !/pro/i.test(m),
);

const MODEL_TIMEOUT_MS = 60_000;

export function getGeminiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  );
}

/** Ambil objek JSON pertama dari respons teks (buang code fence dll). */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  // Code fence yang sudah ditutup
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]?.trim()) return fenced[1].trim();
  // Code fence yang TERPOTONG (respons habis di tengah) -> ambil sisanya
  const openFence = trimmed.match(/```(?:json)?\s*([\s\S]+)$/i);
  if (openFence && openFence[1]?.trim()) return openFence[1].trim();
  //-Object JSON pertama
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    return candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  }
  if (start >= 0) {
    return trimmed.slice(start).replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  }
  return trimmed.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}

/** Coba nutup JSON yang terpotong (respons model kepotong). */
export function tryRepairTruncatedJson(input: string): string | null {
  const s = input.trim();
  const lastObjectEnd = Math.max(s.lastIndexOf("},"), s.lastIndexOf("}"));
  if (lastObjectEnd > 0) {
    const cut = s.slice(0, lastObjectEnd + 1).replace(/,\s*$/, "");
    const candidates = [cut, s.replace(/,\s*$/, "")];
    for (const base of candidates) {
      let attempt = base;
      const quoteCount = (attempt.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 === 1) attempt += '"';
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
      while (stack.length) attempt += stack.pop();
      attempt = attempt.replace(/,\s*([}\]])/g, "$1");
      try {
        JSON.parse(attempt);
        return attempt;
      } catch {
        // lanjut kandidat lain
      }
    }
  }
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

function parseModelJson(text: string): { data: Record<string, unknown> | null; repaired: boolean } {
  const rawJson = extractJson(text);
  try {
    return { data: JSON.parse(rawJson), repaired: false };
  } catch {
    try {
      const sanitized = rawJson.replace(/,\s*([}\]])/g, "$1").replace(/\r\n/g, "\n");
      return { data: JSON.parse(sanitized), repaired: false };
    } catch {
      const repaired = tryRepairTruncatedJson(rawJson);
      if (repaired) {
        try {
          return { data: JSON.parse(repaired), repaired: true };
        } catch {
          return { data: null, repaired: false };
        }
      }
      return { data: null, repaired: false };
    }
  }
}

const RETRYABLE =
  /429|500|502|503|504|404|UNAVAILABLE|RESOURCE_EXHAUSTED|not found|bukan JSON|mengembalikan kosong|timeout|aborted/i;

/**
 * Panggil Gemini Vision dengan prompt + gambar (base64) dan kembalikan JSON parsed.
 * Otomatis coba model lain kalau model pertama error sementara / limit / respons rusak.
 */
export async function callGeminiJson(opts: {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  models?: string[];
  maxOutputTokens?: number;
}): Promise<{
  data: Record<string, unknown>;
  rawText: string;
  model: string;
  /** true kalau JSON harus diperbaiki karena respons kepotong */
  repaired: boolean;
}> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diatur di .env.local");
  }
  const models = Array.from(new Set(opts.models?.length ? opts.models : DEFAULT_MODELS));
  let lastError: Error | null = null;

  console.info("[gemini] Trying models:", models.join(", "));

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
    try {
      console.info(`[gemini] Attempting model: ${model}`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: opts.prompt },
                  {
                    inline_data: {
                      mime_type: opts.mimeType || "image/jpeg",
                      data: opts.imageBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: opts.maxOutputTokens ?? 8192,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        const err = new Error(
          `Gemini error ${res.status} (${model}): ${txt.slice(0, 300)}`,
        );
        lastError = err;
        console.warn(`[gemini] Model failed: ${model} (status ${res.status})`, txt.slice(0, 300));
        if ([429, 500, 502, 503, 504, 404].includes(res.status)) continue;
        throw err;
      }

      const json = await res.json();
      const candidate = json?.candidates?.[0];
      const finishReason = String(candidate?.finishReason || "");
      const text =
        candidate?.content?.parts
          ?.map((p: { text?: string }) => p.text || "")
          .join("") || "";

      // Respons KEPOTONG (output melebihi maxOutputTokens) -> jangan dipakai,
      // karena datanya jadi tidak lengkap diam-diam (item kepotong).
      if (finishReason === "MAX_TOKENS") {
        const err = new Error(
          `Respons Gemini terpotong (MAX_TOKENS, ${model}): struk terlalu panjang / terlalu banyak item`,
        );
        lastError = err;
        console.warn(`[gemini] Truncated response from ${model} (MAX_TOKENS)`);
        continue;
      }
      if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
        throw new Error(
          `Gambar ditolak oleh filter keamanan AI (${finishReason}). Coba foto struk yang lain.`,
        );
      }
      if (finishReason && finishReason !== "STOP") {
        console.warn(`[gemini] Unexpected finishReason from ${model}: ${finishReason}`);
      }
      if (!text) {
        console.warn(`[gemini] Empty response from model: ${model}`);
        throw new Error(`Gemini (${model}) mengembalikan kosong`);
      }

      const { data: parsed, repaired } = parseModelJson(text);
      if (!parsed || typeof parsed !== "object") {
        console.warn(`[gemini] Non-JSON response from ${model}:`, text.slice(0, 500));
        throw new Error(`Respons Gemini (${model}) bukan JSON`);
      }
      if (repaired) {
        console.warn(
          `[gemini] Response from ${model} was truncated & repaired — data mungkin tidak lengkap`,
        );
      }

      console.info(`[gemini] Model succeeded: ${model} (repaired=${repaired})`);
      return { data: parsed, rawText: text, model, repaired };
    } catch (err) {
      lastError = err as Error;
      const msg = String((err as Error)?.message || "");
      if (RETRYABLE.test(msg)) {
        console.warn(`[gemini] Falling back from ${model}: ${msg}`);
        continue;
      }
      console.error(`[gemini] Non-retryable error on ${model}:`, err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  console.error("[gemini] All models failed", lastError);
  throw lastError || new Error("Semua model Gemini gagal memproses struk");
}
