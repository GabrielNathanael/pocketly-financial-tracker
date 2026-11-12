-- 026: rincian item transaksi (JSONB)
-- Menyimpan rincian item (nama, qty, harga satuan, total baris) hasil scan struk
-- (Quick Add) atau Catat Porsi (Split Bill), supaya bisa di-query / di-report
-- per item tanpa parse teks.
--
-- CATATAN: kolom `description` tetap menyimpan ringkasan "[Items: ...]" supaya
-- data lama, audit log, dan tampilan yang sudah jalan sekarang tetap aman.

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS items JSONB;

COMMENT ON COLUMN public.transactions.items IS
    'Rincian item transaksi (JSON array: [{name, quantity, price, subtotal}])';
