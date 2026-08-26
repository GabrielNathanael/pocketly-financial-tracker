-- ==============================================================================
-- 009_FIX_AUDIT_TRIGGER_USER_ID.SQL
-- Fix NULL user_id on child tables (like debt_payments) in universal audit trigger
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_universal_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
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
