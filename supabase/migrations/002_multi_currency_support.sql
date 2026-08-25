-- ==============================================================================
-- 002_MULTI_CURRENCY_SUPPORT.SQL
-- Permanently drops restrictive CHECK constraints & ensures UPDATE support for debt payments
-- ==============================================================================

-- 1. Accounts
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_currency_check;

-- 2. Transactions
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_currency_check;

-- 3. Transfers
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_from_currency_check;
ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_to_currency_check;

-- 4. Debts
ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_currency_check;

-- 5. Enable UPDATE policy for debt_payments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'debt_payments' AND policyname = 'Users can update debt payments for their debts'
    ) THEN
        CREATE POLICY "Users can update debt payments for their debts" ON public.debt_payments FOR UPDATE
            USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
    END IF;
END $$;

-- 6. Trigger update for debt_payments UPDATE
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

DROP TRIGGER IF EXISTS trg_debt_payment ON public.debt_payments;
CREATE TRIGGER trg_debt_payment
    AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_debt_payment_change();
