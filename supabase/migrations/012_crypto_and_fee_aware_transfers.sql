-- Pocketly migration 012: Crypto assets and fee-aware platform withdrawals.

ALTER TABLE public.transfers
    ADD COLUMN IF NOT EXISTS fee_amount NUMERIC NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    ADD COLUMN IF NOT EXISTS fee_mode TEXT NOT NULL DEFAULT 'added_to_source'
        CHECK (fee_mode IN ('added_to_source', 'deducted_from_amount')),
    ADD COLUMN IF NOT EXISTS net_amount NUMERIC;

UPDATE public.transfers
SET net_amount = amount
WHERE net_amount IS NULL;

ALTER TABLE public.transfers
    ALTER COLUMN net_amount SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.crypto_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    cost_basis NUMERIC NOT NULL DEFAULT 0 CHECK (cost_basis >= 0),
    average_buy_price NUMERIC NOT NULL DEFAULT 0 CHECK (average_buy_price >= 0),
    manual_price NUMERIC NOT NULL DEFAULT 0 CHECK (manual_price >= 0),
    price_currency TEXT NOT NULL DEFAULT 'IDR',
    price_updated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crypto_holdings_symbol_account_unique UNIQUE (user_id, account_id, symbol)
);

CREATE TABLE IF NOT EXISTS public.crypto_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    holding_id UUID REFERENCES public.crypto_holdings(id) ON DELETE SET NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    gross_amount NUMERIC NOT NULL CHECK (gross_amount > 0),
    fee_amount NUMERIC NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    fee_currency TEXT NOT NULL DEFAULT 'IDR',
    price_per_unit NUMERIC NOT NULL CHECK (price_per_unit > 0),
    cost_basis NUMERIC NOT NULL DEFAULT 0 CHECK (cost_basis >= 0),
    realized_pnl NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    trade_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crypto_holdings_user ON public.crypto_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_trades_user_date ON public.crypto_trades(user_id, trade_date DESC);

ALTER TABLE public.crypto_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own crypto holdings" ON public.crypto_holdings;
CREATE POLICY "Users can manage own crypto holdings" ON public.crypto_holdings
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own crypto trades" ON public.crypto_trades;
CREATE POLICY "Users can manage own crypto trades" ON public.crypto_trades
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_audit_crypto_holdings ON public.crypto_holdings;
CREATE TRIGGER trg_audit_crypto_holdings
    AFTER INSERT OR UPDATE OR DELETE ON public.crypto_holdings
    FOR EACH ROW EXECUTE FUNCTION public.handle_universal_audit_log();

DROP TRIGGER IF EXISTS trg_audit_crypto_trades ON public.crypto_trades;
CREATE TRIGGER trg_audit_crypto_trades
    AFTER INSERT OR UPDATE OR DELETE ON public.crypto_trades
    FOR EACH ROW EXECUTE FUNCTION public.handle_universal_audit_log();
