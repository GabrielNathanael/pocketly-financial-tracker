/**
 * Pesan error scan yang ramah user.
 * Apapun error teknis dari server (Gemini error 4xx, Postgres error, dll)
 * diterjemahkan jadi kalimat yang bisa dimengerti user.
 * Kalau errornya nggak dikenali -> pakai pesan generik (JANGAN tampilkan detail teknis).
 */
export function friendlyScanError(raw: unknown, language: "id" | "en" = "id"): string {
  const msg = String(
    (raw as Error)?.message || (typeof raw === "string" ? raw : "") || "",
  );
  const m = msg.toLowerCase();

  if (/429|quota|rate.?limit|resource_exhausted|terlalu banyak permintaan/.test(m)) {
    return language === "id"
      ? "Layanan AI sedang sibuk atau batas penggunaan tercapai. Coba lagi beberapa saat lagi."
      : "AI service is busy or usage limit reached. Please try again in a moment.";
  }
  if (/max_tokens|terpotong|truncat/.test(m)) {
    return language === "id"
      ? "Struk terlalu panjang atau itemnya terlalu banyak. Coba foto struk per bagian."
      : "Receipt is too long or has too many items. Try photographing it in parts.";
  }
  if (/safety|prohibited|ditolak oleh filter/.test(m)) {
    return language === "id"
      ? "Gambar ditolak oleh filter keamanan AI. Coba foto yang lain."
      : "Image rejected by AI safety filters. Try another photo.";
  }
  if (/gemini_api_key|belum diatur|tidak dikonfigurasi/.test(m)) {
    return language === "id"
      ? "Fitur scan AI belum dikonfigurasi. Hubungi developer aplikasi."
      : "AI scan is not configured yet. Please contact the app developer.";
  }
  if (/terlalu besar|too large|maximum allowed size|413/.test(m)) {
    return language === "id"
      ? "Ukuran gambar terlalu besar, coba foto ulang lebih dekat dan lebih jelas."
      : "Image is too large, try again closer and clearer.";
  }
  if (/tidak ada item|tidak ada data|no items|no data/.test(m)) {
    return language === "id"
      ? "Tidak ada item yang terbaca dari struk ini. Pastikan foto struk jelas."
      : "No items could be read from this receipt. Make sure the photo is clear.";
  }
  if (/canvas|tidak tersedia|gagal memproses gambar/.test(m)) {
    return language === "id"
      ? "Gagal memproses gambar. Coba foto ulang."
      : "Could not process the image. Please try again.";
  }

  // Default: JANGAN bocorkan detail teknis ke user.
  return language === "id"
    ? "Gagal membaca struk. Pastikan foto jelas lalu coba lagi."
    : "Failed to read receipt. Make sure the photo is clear and try again.";
}
