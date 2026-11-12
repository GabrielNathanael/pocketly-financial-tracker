-- ==============================================================================
-- 024_SPLIT_BILL.SQL
-- Split Bill feature: bills, participants, items, assignments, charges, images, contacts
-- ==============================================================================

-- Contacts (reusable friends/participants)
CREATE TABLE IF NOT EXISTS public.split_bill_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate contact names per user (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_bill_contacts_user_name_unique
    ON public.split_bill_contacts (user_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_split_bill_contacts_user_id ON public.split_bill_contacts(user_id);

ALTER TABLE public.split_bill_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own split bill contacts" ON public.split_bill_contacts;
CREATE POLICY "Users can manage own split bill contacts"
    ON public.split_bill_contacts FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Split bills (header)
CREATE TABLE IF NOT EXISTS public.split_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    currency TEXT NOT NULL DEFAULT 'IDR',
    -- amounts in bill currency (snapshot/inputs)
    subtotal_amount NUMERIC(20,6) NOT NULL DEFAULT 0,
    grand_total_amount NUMERIC(20,6) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'balanced')),
    notes TEXT,
    -- "my portion" recording (optional, weak reference to main transaction)
    my_participant_id UUID, -- FK added below
    my_recorded_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    my_recorded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_split_bills_user_id ON public.split_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_split_bills_status ON public.split_bills(status);
CREATE INDEX IF NOT EXISTS idx_split_bills_bill_date ON public.split_bills(bill_date);

ALTER TABLE public.split_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own split bills" ON public.split_bills;
CREATE POLICY "Users can manage own split bills"
    ON public.split_bills FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Participants per split bill
CREATE TABLE IF NOT EXISTS public.split_bill_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    split_bill_id UUID NOT NULL REFERENCES public.split_bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.split_bill_contacts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    is_me BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_split_bill_participants_split_bill_id ON public.split_bill_participants(split_bill_id);
CREATE INDEX IF NOT EXISTS idx_split_bill_participants_user_id ON public.split_bill_participants(user_id);

ALTER TABLE public.split_bill_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own split bill participants" ON public.split_bill_participants;
CREATE POLICY "Users can manage own split bill participants"
    ON public.split_bill_participants FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add FK from split_bills.my_participant_id now that participants table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'split_bills_my_participant_id_fkey'
    ) THEN
        ALTER TABLE public.split_bills
            ADD CONSTRAINT split_bills_my_participant_id_fkey
            FOREIGN KEY (my_participant_id) REFERENCES public.split_bill_participants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Items
CREATE TABLE IF NOT EXISTS public.split_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    split_bill_id UUID NOT NULL REFERENCES public.split_bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC(20,6) NOT NULL DEFAULT 1,
    unit_price NUMERIC(20,6) NOT NULL DEFAULT 0,
    -- effective/printed line subtotal
    line_subtotal NUMERIC(20,6) NOT NULL DEFAULT 0,
    item_discount NUMERIC(20,6) NOT NULL DEFAULT 0, -- per-item discount amount
    sort_order INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_split_bill_items_split_bill_id ON public.split_bill_items(split_bill_id);
CREATE INDEX IF NOT EXISTS idx_split_bill_items_user_id ON public.split_bill_items(user_id);

ALTER TABLE public.split_bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own split bill items" ON public.split_bill_items;
CREATE POLICY "Users can manage own split bill items"
    ON public.split_bill_items FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Assignments: portion of an item to a participant (by quantity/share)
CREATE TABLE IF NOT EXISTS public.split_bill_item_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.split_bill_items(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.split_bill_participants(id) ON DELETE CASCADE,
    split_bill_id UUID NOT NULL REFERENCES public.split_bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_quantity NUMERIC(20,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT split_bill_item_assignments_unique UNIQUE (item_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_split_bill_assignments_item_id ON public.split_bill_item_assignments(item_id);
CREATE INDEX IF NOT EXISTS idx_split_bill_assignments_participant_id ON public.split_bill_item_assignments(participant_id);
CREATE INDEX IF NOT EXISTS idx_split_bill_assignments_split_bill_id ON public.split_bill_item_assignments(split_bill_id);

ALTER TABLE public.split_bill_item_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own split bill assignments" ON public.split_bill_item_assignments;
CREATE POLICY "Users can manage own split bill assignments"
    ON public.split_bill_item_assignments FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bill-level charges/fees/discounts (multiple components)
CREATE TABLE IF NOT EXISTS public.split_bill_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    split_bill_id UUID NOT NULL REFERENCES public.split_bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('tax', 'service', 'discount', 'other')),
    amount_mode TEXT NOT NULL CHECK (amount_mode IN ('percent', 'fixed')),
    amount_value NUMERIC(20,6) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_split_bill_charges_split_bill_id ON public.split_bill_charges(split_bill_id);

ALTER TABLE public.split_bill_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own split bill charges" ON public.split_bill_charges;
CREATE POLICY "Users can manage own split bill charges"
    ON public.split_bill_charges FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Images (multi per split bill, optional)
CREATE TABLE IF NOT EXISTS public.split_bill_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    split_bill_id UUID NOT NULL REFERENCES public.split_bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    size_bytes INT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_split_bill_images_split_bill_id ON public.split_bill_images(split_bill_id);
CREATE INDEX IF NOT EXISTS idx_split_bill_images_user_id ON public.split_bill_images(user_id);

ALTER TABLE public.split_bill_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own split bill images" ON public.split_bill_images;
CREATE POLICY "Users can manage own split bill images"
    ON public.split_bill_images FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for split bill receipt images (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('split-bill-images', 'split-bill-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can manage files under their own folder (user_id/*)
DROP POLICY IF EXISTS "Split bill images insert own" ON storage.objects;
CREATE POLICY "Split bill images insert own"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'split-bill-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Split bill images select own" ON storage.objects;
CREATE POLICY "Split bill images select own"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'split-bill-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Split bill images update own" ON storage.objects;
CREATE POLICY "Split bill images update own"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'split-bill-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Split bill images delete own" ON storage.objects;
CREATE POLICY "Split bill images delete own"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'split-bill-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
