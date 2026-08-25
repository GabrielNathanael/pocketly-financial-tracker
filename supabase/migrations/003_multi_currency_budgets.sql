-- ==============================================================================
-- 003_MULTI_CURRENCY_BUDGETS.SQL
-- Supports multi-currency budgeting per category & closes public exchange_rates INSERT policy
-- ==============================================================================

-- 1. Add currency column to budgets if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'budgets' AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.budgets ADD COLUMN currency text NOT NULL DEFAULT 'IDR';
    END IF;
END $$;

-- 2. Drop legacy unique constraint on (user_id, category_id, period_start_date)
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_id_period_start_date_key;
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_user_category_period_unique;

-- 3. Create composite unique constraint with currency included
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'budgets_user_category_currency_period_unique'
    ) THEN
        ALTER TABLE public.budgets 
        ADD CONSTRAINT budgets_user_category_currency_period_unique 
        UNIQUE (user_id, category_id, currency, period_start_date);
    END IF;
END $$;

-- 4. Secure exchange_rates table by dropping public INSERT policy (only Service Role can insert)
DROP POLICY IF EXISTS "Service or authenticated can insert exchange rates" ON public.exchange_rates;
