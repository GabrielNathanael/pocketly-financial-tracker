-- ==============================================================================
-- 007_SAVINGS_GOALS.SQL
-- Savings Goals & Wishlist Tracker for Pocketly
-- ==============================================================================

-- 1. Create savings_goals table
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD', 'SGD')),
    target_date DATE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    icon VARCHAR(100) NOT NULL DEFAULT 'Target',
    color VARCHAR(50) NOT NULL DEFAULT '#0D9488',
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create savings_goal_deposits table
CREATE TABLE IF NOT EXISTS public.savings_goal_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdraw')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD', 'SGD')),
    deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for fast query retrieval
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON public.savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_status ON public.savings_goals(status);
CREATE INDEX IF NOT EXISTS idx_savings_goals_target_date ON public.savings_goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_goal_id ON public.savings_goal_deposits(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_user_id ON public.savings_goal_deposits(user_id);

-- 4. Row Level Security (RLS) for savings_goals
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own savings goals" ON public.savings_goals;
CREATE POLICY "Users can view their own savings goals"
    ON public.savings_goals FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own savings goals" ON public.savings_goals;
CREATE POLICY "Users can insert their own savings goals"
    ON public.savings_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own savings goals" ON public.savings_goals;
CREATE POLICY "Users can update their own savings goals"
    ON public.savings_goals FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own savings goals" ON public.savings_goals;
CREATE POLICY "Users can delete their own savings goals"
    ON public.savings_goals FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Row Level Security (RLS) for savings_goal_deposits
ALTER TABLE public.savings_goal_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own goal deposits" ON public.savings_goal_deposits;
CREATE POLICY "Users can view their own goal deposits"
    ON public.savings_goal_deposits FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own goal deposits" ON public.savings_goal_deposits;
CREATE POLICY "Users can insert their own goal deposits"
    ON public.savings_goal_deposits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own goal deposits" ON public.savings_goal_deposits;
CREATE POLICY "Users can update their own goal deposits"
    ON public.savings_goal_deposits FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own goal deposits" ON public.savings_goal_deposits;
CREATE POLICY "Users can delete their own goal deposits"
    ON public.savings_goal_deposits FOR DELETE
    USING (auth.uid() = user_id);

-- 6. Universal Audit Trail Triggers
DROP TRIGGER IF EXISTS trg_savings_goals_audit ON public.savings_goals;
CREATE TRIGGER trg_savings_goals_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.savings_goals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();

DROP TRIGGER IF EXISTS trg_savings_goal_deposits_audit ON public.savings_goal_deposits;
CREATE TRIGGER trg_savings_goal_deposits_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.savings_goal_deposits
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();
