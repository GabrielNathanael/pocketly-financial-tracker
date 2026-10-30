-- Link crypto trading fee expenses to their source trade so edits/deletions
-- do not leave orphaned expense records.

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS crypto_trade_id UUID
        REFERENCES public.crypto_trades(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_transactions_crypto_trade
    ON public.transactions(crypto_trade_id);
