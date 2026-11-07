-- 019: Audit fixes — drop derived-state triggers, skip balance-only account
-- updates, lock down audit_logs inserts, add indexes, retention helper.
-- Free-tier friendly: cleanup deletes are batched in a helper function.

-- 1) Drop audit triggers on derived holdings tables.
-- Holdings are auto-maintained summaries of trades; the trade rows
-- themselves are still audited, so no user action is lost.
DROP TRIGGER IF EXISTS trg_audit_stock_holdings ON public.stock_holdings;
DROP TRIGGER IF EXISTS trg_audit_crypto_holdings ON public.crypto_holdings;
DROP TRIGGER IF EXISTS trg_audit_etf_holdings ON public.etf_holdings;

-- 2) Rewrite universal audit function: skip accounts UPDATE when only
-- current_balance changed (side-effect of transaction/transfer triggers).
CREATE OR REPLACE FUNCTION public.handle_universal_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'accounts' THEN
        IF OLD.name IS NOT DISTINCT FROM NEW.name
           AND OLD.type IS NOT DISTINCT FROM NEW.type
           AND OLD.currency IS NOT DISTINCT FROM NEW.currency
           AND OLD.initial_balance IS NOT DISTINCT FROM NEW.initial_balance
           AND OLD.icon IS NOT DISTINCT FROM NEW.icon
           AND OLD.color IS NOT DISTINCT FROM NEW.color
           AND OLD.is_active IS NOT DISTINCT FROM NEW.is_active THEN
            RETURN NEW;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'debt_payments' THEN
            SELECT user_id INTO target_user_id FROM public.debts WHERE id = NEW.debt_id;
        ELSE
            BEGIN
                target_user_id := NEW.user_id;
            EXCEPTION WHEN OTHERS THEN
                target_user_id := NULL;
            END;
        END IF;

        IF target_user_id IS NULL THEN
            target_user_id := auth.uid();
        END IF;

        IF target_user_id IS NOT NULL THEN
            INSERT INTO public.audit_logs (user_id, table_name, record_id, action, new_values, changed_at)
            VALUES (target_user_id, TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), now());
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'debt_payments' THEN
            SELECT user_id INTO target_user_id FROM public.debts WHERE id = NEW.debt_id;
        ELSE
            BEGIN
                target_user_id := NEW.user_id;
            EXCEPTION WHEN OTHERS THEN
                target_user_id := NULL;
            END;
        END IF;

        IF target_user_id IS NULL THEN
            target_user_id := auth.uid();
        END IF;

        IF target_user_id IS NOT NULL THEN
            INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_values, new_values, changed_at)
            VALUES (target_user_id, TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), now());
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'debt_payments' THEN
            SELECT user_id INTO target_user_id FROM public.debts WHERE id = OLD.debt_id;
        ELSE
            BEGIN
                target_user_id := OLD.user_id;
            EXCEPTION WHEN OTHERS THEN
                target_user_id := NULL;
            END;
        END IF;

        IF target_user_id IS NULL THEN
            target_user_id := auth.uid();
        END IF;

        IF target_user_id IS NOT NULL THEN
            INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_values, changed_at)
            VALUES (target_user_id, TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), now());
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Audit logs are trigger-written only; users must not forge entries.
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;

-- 4) Indexes for global audit queries (per-user, newest first).
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_changed
    ON public.audit_logs (user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_table_changed
    ON public.audit_logs (user_id, table_name, changed_at DESC);

-- 5) Cleanup existing useless logs (holdings + balance-only account updates).
DELETE FROM public.audit_logs
WHERE table_name IN ('stock_holdings', 'crypto_holdings', 'etf_holdings');

DELETE FROM public.audit_logs
WHERE table_name = 'accounts'
  AND action = 'UPDATE'
  AND (old_values->>'name' IS NOT DISTINCT FROM new_values->>'name')
  AND (old_values->>'type' IS NOT DISTINCT FROM new_values->>'type')
  AND (old_values->>'currency' IS NOT DISTINCT FROM new_values->>'currency')
  AND (old_values->>'initial_balance' IS NOT DISTINCT FROM new_values->>'initial_balance')
  AND (old_values->>'icon' IS NOT DISTINCT FROM new_values->>'icon')
  AND (old_values->>'color' IS NOT DISTINCT FROM new_values->>'color')
  AND (old_values->>'is_active' IS NOT DISTINCT FROM new_values->>'is_active');

-- 6) Retention helper (batched deletes, free-tier safe).
-- Call manually or schedule via pg_cron from the dashboard:
--   select * from public.cleanup_old_audit_logs(12);
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(retention_months INT DEFAULT 12)
RETURNS BIGINT AS $$
DECLARE
    deleted_count BIGINT := 0;
    batch_count INT;
BEGIN
    LOOP
        DELETE FROM public.audit_logs
        WHERE id IN (
            SELECT id FROM public.audit_logs
            WHERE changed_at < now() - make_interval(months => retention_months)
            LIMIT 1000
        );
        GET DIAGNOSTICS batch_count = ROW_COUNT;
        deleted_count := deleted_count + batch_count;
        EXIT WHEN batch_count = 0;
    END LOOP;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
