-- ==============================================================================
-- 005_FIX_UNIVERSAL_AUDIT_TRIGGER.SQL
-- Fix record_id UUID type casting in handle_universal_audit_log trigger
-- ==============================================================================

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
