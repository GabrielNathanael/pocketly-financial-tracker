-- Link stock trading stamp-duty expenses to their source trade so edits
-- and deletions do not leave orphaned expense records.

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS stock_trade_id UUID
        REFERENCES public.stock_trades(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_transactions_stock_trade
    ON public.transactions(stock_trade_id);
