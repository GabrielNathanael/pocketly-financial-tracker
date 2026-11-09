-- 021: Market price cache for owned assets (stocks IDX, crypto, US ETFs).
-- Global cache (not per-user) — cron refreshes daily for tickers that
-- actually appear in holdings, so API calls stay minimal on free tier.

CREATE TABLE IF NOT EXISTS public.asset_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('stock', 'crypto', 'etf')),
    symbol TEXT NOT NULL,
    price NUMERIC NOT NULL CHECK (price >= 0),
    currency TEXT NOT NULL DEFAULT 'IDR',
    source TEXT NOT NULL DEFAULT 'stooq',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_asset_prices_kind_symbol UNIQUE (kind, symbol)
);

CREATE INDEX IF NOT EXISTS idx_asset_prices_fetched
    ON public.asset_prices (fetched_at DESC);

ALTER TABLE public.asset_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view asset prices" ON public.asset_prices;
CREATE POLICY "Authenticated can view asset prices"
    ON public.asset_prices FOR SELECT
    TO authenticated
    USING (true);
-- No INSERT/UPDATE/DELETE policy for users: only service-role cron writes.
