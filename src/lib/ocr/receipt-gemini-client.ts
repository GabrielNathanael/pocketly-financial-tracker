"use client";

import { scanReceiptWithGemini } from "@/actions/receipt-ai";
import type { ParsedReceipt } from "@/lib/ocr/receipt-scanner";

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const maxDim = 1600;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas tidak tersedia"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      const comma = dataUrl.indexOf(",");
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = () => reject(new Error("Gagal membaca file"));
  });
}

/**
 * Scan struk pakai Gemini Vision (struktur JSON: merchant, total, rincian item).
 * Return null kalau key belum diatur / error, biar caller bisa fallback ke Tesseract.
 */
export async function scanReceiptGemini(file: File): Promise<ParsedReceipt | null> {
  try {
    const { base64, mimeType } = await fileToBase64(file);
    if (!base64) return null;
    // AI Studio menerima gambar besar, tapi batasi ~7MB biar request nggak timeout
    if (base64.length > 10_000_000) return null;
    const parsed = await scanReceiptWithGemini(base64, mimeType);
    return parsed;
  } catch (err) {
    console.warn("[receipt-gemini]", err);
    return null;
  }
}
