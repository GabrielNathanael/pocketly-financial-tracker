-- ==============================================================================
-- POCKETLY SUPABASE INITIAL SCHEMA MIGRATION
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'ewallet', 'credit_card')),
    currency TEXT NOT NULL DEFAULT 'IDR',
    initial_balance NUMERIC NOT NULL DEFAULT 0,
    current_balance NUMERIC NOT NULL DEFAULT 0,
    icon TEXT,
    color TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT NOT NULL DEFAULT 'Tag',
    color TEXT DEFAULT '#3B82F6',
    is_default BOOLEAN NOT NULL DEFAULT false,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- 3. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    description TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date DESC);

-- 4. TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    from_currency TEXT NOT NULL DEFAULT 'IDR',
    to_currency TEXT NOT NULL DEFAULT 'IDR',
    exchange_rate_used NUMERIC NOT NULL DEFAULT 1,
    description TEXT,
    transfer_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_different_accounts CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers(user_id);

-- 5. BUDGETS TABLE
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    period_start_date DATE NOT NULL, -- Format YYYY-MM-01
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_budget_user_cat_period UNIQUE (user_id, category_id, period_start_date)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.budgets(user_id, period_start_date);

-- 6. DEBTS TABLE
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('debt', 'receivable')),
    counterparty_name TEXT NOT NULL,
    initial_amount NUMERIC NOT NULL CHECK (initial_amount > 0),
    remaining_amount NUMERIC NOT NULL CHECK (remaining_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid')),
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);

-- 7. DEBT PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON public.debt_payments(debt_id);

-- 8. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs(record_id, table_name);

-- 9. EXCHANGE RATES TABLE
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency TEXT NOT NULL,
    target_currency TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON public.exchange_rates(base_currency, target_currency, fetched_at DESC);


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Accounts RLS
CREATE POLICY "Users can view their own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- Categories RLS
CREATE POLICY "Users can view their own categories" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own categories" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categories" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categories" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- Transactions RLS
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- Transfers RLS
CREATE POLICY "Users can view their own transfers" ON public.transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transfers" ON public.transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transfers" ON public.transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transfers" ON public.transfers FOR DELETE USING (auth.uid() = user_id);

-- Budgets RLS
CREATE POLICY "Users can view their own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

-- Debts RLS
CREATE POLICY "Users can view their own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- Debt Payments RLS
CREATE POLICY "Users can view debt payments for their debts" ON public.debt_payments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can insert debt payments for their debts" ON public.debt_payments FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can delete debt payments for their debts" ON public.debt_payments FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can update debt payments for their debts" ON public.debt_payments FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));

-- Audit Logs RLS
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Exchange Rates RLS (Allow authenticated & anon read)
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates FOR SELECT USING (true);
CREATE POLICY "Service or authenticated can insert exchange rates" ON public.exchange_rates FOR INSERT WITH CHECK (true);


-- ==============================================================================
-- DATABASE TRIGGERS & FUNCTIONS
-- ==============================================================================

-- 1. Function & Trigger: Auto initialize current_balance on account creation
CREATE OR REPLACE FUNCTION public.handle_new_account()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_balance := NEW.initial_balance;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_account_init_balance
    BEFORE INSERT ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_account();

-- 2. Function & Trigger: Update account balance on transaction change
CREATE OR REPLACE FUNCTION public.handle_transaction_balance_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF NEW.type = 'expense' THEN
            UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'expense' THEN
            UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Revert OLD effect
        IF OLD.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'expense' THEN
            UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
        END IF;
        -- Apply NEW effect
        IF NEW.type = 'income' THEN
            UPDATE public.accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF NEW.type = 'expense' THEN
            UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
        NEW.updated_at := now();
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_transaction_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_transaction_balance_change();

-- 3. Function & Trigger: Update account balance on transfer
CREATE OR REPLACE FUNCTION public.handle_transfer_balance_change()
RETURNS TRIGGER AS $$
DECLARE
    to_amount NUMERIC;
    old_to_amount NUMERIC;
BEGIN
    IF TG_OP = 'INSERT' THEN
        to_amount := NEW.amount * NEW.exchange_rate_used;
        UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_account_id;
        UPDATE public.accounts SET current_balance = current_balance + to_amount WHERE id = NEW.to_account_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        old_to_amount := OLD.amount * OLD.exchange_rate_used;
        UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.from_account_id;
        UPDATE public.accounts SET current_balance = current_balance - old_to_amount WHERE id = OLD.to_account_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Revert OLD
        old_to_amount := OLD.amount * OLD.exchange_rate_used;
        UPDATE public.accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.from_account_id;
        UPDATE public.accounts SET current_balance = current_balance - old_to_amount WHERE id = OLD.to_account_id;
        -- Apply NEW
        to_amount := NEW.amount * NEW.exchange_rate_used;
        UPDATE public.accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_account_id;
        UPDATE public.accounts SET current_balance = current_balance + to_amount WHERE id = NEW.to_account_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_transfer_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_transfer_balance_change();

-- 4. Function & Trigger: Debt remaining amount on payment
CREATE OR REPLACE FUNCTION public.handle_debt_payment_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.debts 
        SET remaining_amount = GREATEST(0, remaining_amount - NEW.amount),
            status = CASE WHEN remaining_amount - NEW.amount <= 0 THEN 'paid' ELSE 'active' END
        WHERE id = NEW.debt_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.debts 
        SET remaining_amount = GREATEST(0, remaining_amount + OLD.amount - NEW.amount),
            status = CASE WHEN (remaining_amount + OLD.amount - NEW.amount) <= 0 THEN 'paid' ELSE 'active' END
        WHERE id = NEW.debt_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.debts 
        SET remaining_amount = remaining_amount + OLD.amount,
            status = CASE WHEN remaining_amount + OLD.amount > 0 THEN 'active' ELSE 'paid' END
        WHERE id = OLD.debt_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_debt_payment
    AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_debt_payment_change();

-- 5. Function & Trigger: Auto init debt remaining amount
CREATE OR REPLACE FUNCTION public.handle_new_debt()
RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_amount := NEW.initial_amount;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_debt_init_remaining
    BEFORE INSERT ON public.debts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_debt();

-- 6. Function & Trigger: Audit Log for Transactions
CREATE OR REPLACE FUNCTION public.handle_transaction_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (user_id, table_name, record_id, action, new_values, changed_at)
        VALUES (NEW.user_id, 'transactions', NEW.id, 'INSERT', to_jsonb(NEW), now());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_values, new_values, changed_at)
        VALUES (NEW.user_id, 'transactions', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), now());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_values, changed_at)
        VALUES (OLD.user_id, 'transactions', OLD.id, 'DELETE', to_jsonb(OLD), now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_transaction_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_transaction_audit_log();

-- 7. Seed Default Categories Function on User Creation
CREATE OR REPLACE FUNCTION public.seed_user_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- Expense categories
    INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
    (NEW.id, 'Food & Drinks', 'expense', 'UtensilsCrossed', '#F97316', true),
    (NEW.id, 'Transportation', 'expense', 'Car', '#3B82F6', true),
    (NEW.id, 'Shopping', 'expense', 'ShoppingBag', '#EC4899', true),
    (NEW.id, 'Bills & Utilities', 'expense', 'Receipt', '#EAB308', true),
    (NEW.id, 'Entertainment', 'expense', 'Film', '#8B5CF6', true),
    (NEW.id, 'Health & Medical', 'expense', 'HeartPulse', '#EF4444', true),
    (NEW.id, 'Housing', 'expense', 'Home', '#10B981', true),
    (NEW.id, 'Education', 'expense', 'GraduationCap', '#06B6D4', true),
    (NEW.id, 'Personal Care', 'expense', 'Sparkles', '#F43F5E', true),
    (NEW.id, 'Other Expense', 'expense', 'MoreHorizontal', '#6B7280', true);

    -- Income categories
    INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
    (NEW.id, 'Salary', 'income', 'Briefcase', '#10B981', true),
    (NEW.id, 'Freelance & Side Gig', 'income', 'Laptop', '#3B82F6', true),
    (NEW.id, 'Investments & Dividends', 'income', 'TrendingUp', '#8B5CF6', true),
    (NEW.id, 'Gifts & Grants', 'income', 'Gift', '#EC4899', true),
    (NEW.id, 'Other Income', 'income', 'PlusCircle', '#6B7280', true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.seed_user_default_categories();
