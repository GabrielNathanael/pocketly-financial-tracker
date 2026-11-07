-- 020: Daily net worth snapshots for trend chart.
-- One row per user per day, totals stored in IDR (canonical base)
-- plus the forex rates used at snapshot time so historical points
-- can be re-displayed in USD/SGD without drifting with today's rates.

CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_assets_idr NUMERIC NOT NULL DEFAULT 0,
    total_liabilities_idr NUMERIC NOT NULL DEFAULT 0,
    net_worth_idr NUMERIC NOT NULL DEFAULT 0,
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_net_worth_snapshots_user_date UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_date
    ON public.net_worth_snapshots (user_id, snapshot_date DESC);

ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can view their own net worth snapshots"
    ON public.net_worth_snapshots FOR SELECT
    USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy for users: snapshots are written only
-- by the service-role cron job (bypasses RLS).
