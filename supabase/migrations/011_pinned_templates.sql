-- ==============================================================================
-- 011_PINNED_TEMPLATES.SQL
-- Pinned Fast-Log Transaction Templates for Pocketly
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.pinned_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pinned_templates_user_id ON public.pinned_templates(user_id);

ALTER TABLE public.pinned_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pinned templates" ON public.pinned_templates;
CREATE POLICY "Users can manage own pinned templates"
    ON public.pinned_templates
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
