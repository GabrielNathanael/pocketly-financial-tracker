-- 022: Prevent transfers between the same account at the database level.
-- The app already blocks this in the UI + server action, but the trigger
-- handle_transfer_balance_change() would happily net-zero a same-account
-- transfer and leave a phantom transfer row behind.

ALTER TABLE public.transfers
    DROP CONSTRAINT IF EXISTS transfers_distinct_accounts_check;

ALTER TABLE public.transfers
    ADD CONSTRAINT transfers_distinct_accounts_check
    CHECK (from_account_id <> to_account_id);
