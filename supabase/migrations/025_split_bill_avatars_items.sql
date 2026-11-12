-- 025: avatar peserta/kontak (Split Bill) + mode bagi rata
-- Avatar disimpan sebagai (style + seed) supaya SVG-nya bisa di-generate ulang
-- tanpa menyimpan file di storage.

-- 1) Avatar pada kontak tersimpan
ALTER TABLE public.split_bill_contacts
    ADD COLUMN IF NOT EXISTS avatar_style TEXT,
    ADD COLUMN IF NOT EXISTS avatar_seed TEXT;

-- 2) Avatar pada peserta patungan (bisa ada walau pesertanya bukan kontak tersimpan)
ALTER TABLE public.split_bill_participants
    ADD COLUMN IF NOT EXISTS avatar_style TEXT,
    ADD COLUMN IF NOT EXISTS avatar_seed TEXT;

-- 3) Mode pembagian patungan: 'proportional' (default) atau 'equal' (bagi rata)
ALTER TABLE public.split_bills
    ADD COLUMN IF NOT EXISTS split_mode TEXT NOT NULL DEFAULT 'proportional';

COMMENT ON COLUMN public.split_bills.split_mode IS
    'proportional = biaya dibagi sesuai nilai item; equal = semua orang bayar sama';

COMMENT ON COLUMN public.split_bill_participants.avatar_style IS
    'Style avatar (mis. micah, personas)';
COMMENT ON COLUMN public.split_bill_participants.avatar_seed IS
    'Seed avatar (deterministik per nama)';
COMMENT ON COLUMN public.split_bill_contacts.avatar_style IS
    'Style avatar (mis. micah, personas)';
COMMENT ON COLUMN public.split_bill_contacts.avatar_seed IS
    'Seed avatar (deterministik per nama)';
