"use client";

import { scanReceiptWithGemini } from "@/actions/receipt-ai";
import type { ParsedReceipt } from "@/lib/ocr/receipt-scanner";

function fileToImageBlob(file: File): Promise<{ blob: Blob; mimeType: string }> {
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
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Gagal memproses gambar struk"));
            return;
          }
          resolve({ blob, mimeType: "image/jpeg" });
        },
        "image/jpeg",
        0.72,
      );
    };
    img.onerror = () => reject(new Error("Gagal membaca file"));
  });
}

/**
 * Scan struk pakai Gemini Vision (struktur JSON: merchant, total, rincian item).
 * Melempar error jika gagal agar caller bisa menampilkan status gagal & minta scan ulang.
 */
export async function scanReceiptGemini(
  file: File,
  currency: string = "IDR",
): Promise<ParsedReceipt> {
  const { blob, mimeType } = await fileToImageBlob(file);
  if (!blob || blob.size === 0) throw new Error("Gagal memproses gambar struk");
  // Batasi ~7MB biar request nggak timeout
  if (blob.size > 7_000_000) {
    throw new Error("Ukuran gambar terlalu besar, coba foto ulang lebih dekat/jelas");
  }

  const formData = new FormData();
  formData.append("file", blob, "receipt.jpg");
  formData.append("mimeType", mimeType);
  formData.append("currency", currency || "IDR");

  return await scanReceiptWithGemini(formData);
}
