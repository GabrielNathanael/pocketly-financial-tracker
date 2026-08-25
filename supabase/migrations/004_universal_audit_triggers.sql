-- ==============================================================================
-- 004_UNIVERSAL_AUDIT_TRIGGERS.SQL
-- Universal Audit Trail Triggers for All Pocketly Entities
-- ==============================================================================

-- 1. Generic Universal Audit Trigger Function
CREATE OR REPLACE FUNCTION public.handle_universal_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (user_id, table_name, record_id, action, new_values, changed_at)
        VALUES (NEW.user_id, TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), now());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_values, new_values, changed_at)
        VALUES (NEW.user_id, TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), now());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_values, changed_at)
        VALUES (OLD.user_id, TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), now());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Triggers to Transfers
DROP TRIGGER IF EXISTS trg_transfer_audit ON public.transfers;
CREATE TRIGGER trg_transfer_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();

-- 3. Attach Triggers to Debts
DROP TRIGGER IF EXISTS trg_debt_audit ON public.debts;
CREATE TRIGGER trg_debt_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.debts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();

-- 4. Attach Triggers to Debt Payments
DROP TRIGGER IF EXISTS trg_debt_payment_audit ON public.debt_payments;
CREATE TRIGGER trg_debt_payment_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();

-- 5. Attach Triggers to Accounts
DROP TRIGGER IF EXISTS trg_account_audit ON public.accounts;
CREATE TRIGGER trg_account_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();

-- 6. Attach Triggers to Categories
DROP TRIGGER IF EXISTS trg_category_audit ON public.categories;
CREATE TRIGGER trg_category_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();

-- 7. Attach Triggers to Budgets
DROP TRIGGER IF EXISTS trg_budget_audit ON public.budgets;
CREATE TRIGGER trg_budget_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();
