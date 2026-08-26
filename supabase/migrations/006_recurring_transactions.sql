-- ==============================================================================
-- 006_RECURRING_TRANSACTIONS.SQL
-- Recurring Transactions & Subscription Management for Pocketly
-- ==============================================================================

-- 1. Create recurring_transactions table
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'IDR' CHECK (currency IN ('IDR', 'USD', 'SGD')),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count > 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    next_due_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_process BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    last_processed_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON public.recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_due_date ON public.recurring_transactions(next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_is_active ON public.recurring_transactions(is_active);

-- 3. Row Level Security (RLS)
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Users can view their own recurring transactions"
    ON public.recurring_transactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Users can insert their own recurring transactions"
    ON public.recurring_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Users can update their own recurring transactions"
    ON public.recurring_transactions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Users can delete their own recurring transactions"
    ON public.recurring_transactions FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Universal Audit Trail Trigger for Recurring Transactions
DROP TRIGGER IF EXISTS trg_recurring_transactions_audit ON public.recurring_transactions;
CREATE TRIGGER trg_recurring_transactions_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.recurring_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();
