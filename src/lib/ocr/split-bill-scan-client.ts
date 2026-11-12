"use client";

import { scanReceiptForSplitBill, type SplitBillScanResult } from "@/actions/split-bill-scan";

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
      if (!ctx) { reject(new Error("Canvas tidak tersedia")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Gagal memproses gambar")); return; }
          resolve({ blob, mimeType: "image/jpeg" });
        },
        "image/jpeg",
        0.72,
      );
    };
    img.onerror = () => reject(new Error("Gagal membaca file"));
  });
}

export async function scanSplitBillReceipt(file: File, currency: string = "IDR"): Promise<SplitBillScanResult> {
  const { blob, mimeType } = await fileToImageBlob(file);
  if (!blob || blob.size === 0) throw new Error("Gagal memproses gambar");
  if (blob.size > 7_000_000) throw new Error("Ukuran gambar terlalu besar");
  const formData = new FormData();
  formData.append("file", blob, "receipt.jpg");
  formData.append("mimeType", mimeType);
  formData.append("currency", currency || "IDR");
  return await scanReceiptForSplitBill(formData);
}
