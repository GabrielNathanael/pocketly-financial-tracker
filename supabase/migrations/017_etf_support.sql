-- 017: ETF US SUPPORT (IDR settlement via local broker)
CREATE TABLE IF NOT EXISTS public.etf_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    avg_buy_price NUMERIC NOT NULL DEFAULT 0,
    broker_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etf_holdings_user_id ON public.etf_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_etf_holdings_account_id ON public.etf_holdings(account_id);

CREATE TABLE IF NOT EXISTS public.etf_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    price_per_unit NUMERIC NOT NULL DEFAULT 0,
    gross_amount NUMERIC NOT NULL DEFAULT 0,
    fee_amount NUMERIC NOT NULL DEFAULT 0,
    buy_cost NUMERIC NOT NULL DEFAULT 0,
    realized_pnl NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    trade_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etf_trades_user_id ON public.etf_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_etf_trades_account_id ON public.etf_trades(account_id);
CREATE INDEX IF NOT EXISTS idx_etf_trades_trade_date ON public.etf_trades(trade_date DESC);

ALTER TABLE public.etf_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etf_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own etf holdings" ON public.etf_holdings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own etf trades" ON public.etf_trades FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_audit_etf_holdings AFTER INSERT OR UPDATE OR DELETE ON public.etf_holdings FOR EACH ROW EXECUTE FUNCTION public.handle_universal_audit_log();
CREATE OR REPLACE TRIGGER trg_audit_etf_trades AFTER INSERT OR UPDATE OR DELETE ON public.etf_trades FOR EACH ROW EXECUTE FUNCTION public.handle_universal_audit_log();
