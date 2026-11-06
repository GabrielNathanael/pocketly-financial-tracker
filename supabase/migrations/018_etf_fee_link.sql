-- 018: Link ETF trading fee expenses to their source trade so edits/deletions
-- do not leave orphaned expense records (mirrors 013 for crypto).

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS etf_trade_id UUID
        REFERENCES public.etf_trades(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_transactions_etf_trade
    ON public.transactions(etf_trade_id);
