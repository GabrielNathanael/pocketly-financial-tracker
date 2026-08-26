-- ==============================================================================
-- POCKETLY MIGRATION 010: INVESTMENTS & STOCK TRADES (RDN) SUPPORT
-- ==============================================================================

-- 1. Update Accounts table check constraint to support 'investment'
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_type_check 
    CHECK (type IN ('bank', 'cash', 'ewallet', 'credit_card', 'investment'));

-- 2. STOCK HOLDINGS TABLE (Active Open Stock Positions)
CREATE TABLE IF NOT EXISTS public.stock_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    total_cost NUMERIC NOT NULL CHECK (total_cost >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_holdings_user_id ON public.stock_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_holdings_account_id ON public.stock_holdings(account_id);

-- 3. STOCK TRADES TABLE (Buy & Sell History Log)
CREATE TABLE IF NOT EXISTS public.stock_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    holding_id UUID REFERENCES public.stock_holdings(id) ON DELETE SET NULL,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    net_amount NUMERIC NOT NULL CHECK (net_amount > 0),
    buy_cost NUMERIC DEFAULT 0,
    realized_pnl NUMERIC DEFAULT 0,
    notes TEXT,
    trade_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_trades_user_id ON public.stock_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_account_id ON public.stock_trades(account_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_trade_date ON public.stock_trades(trade_date DESC);

-- 4. Enable RLS
ALTER TABLE public.stock_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_trades ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Users can manage own stock holdings"
    ON public.stock_holdings
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own stock trades"
    ON public.stock_trades
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Universal Audit Log Triggers
CREATE OR REPLACE TRIGGER trg_audit_stock_trades
    AFTER INSERT OR UPDATE OR DELETE ON public.stock_trades
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();

CREATE OR REPLACE TRIGGER trg_audit_stock_holdings
    AFTER INSERT OR UPDATE OR DELETE ON public.stock_holdings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_universal_audit_log();

