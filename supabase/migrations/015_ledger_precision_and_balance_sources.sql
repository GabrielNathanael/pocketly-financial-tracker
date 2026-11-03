-- Crypto holdings are a transaction ledger, not a live market valuation.
ALTER TABLE public.crypto_holdings
    DROP COLUMN IF EXISTS manual_price,
    DROP COLUMN IF EXISTS price_updated_at;

-- Keep an explicit source trail for future direct balance changes.
CREATE TABLE IF NOT EXISTS public.account_balance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (
        source_type IN (
            'stock_trade',
            'crypto_trade',
            'transfer',
            'transaction',
            'adjustment'
        )
    ),
    source_id UUID,
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    balance_before NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_balance_events_account
    ON public.account_balance_events(account_id, created_at DESC);

ALTER TABLE public.account_balance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own balance events"
    ON public.account_balance_events;
CREATE POLICY "Users can view own balance events"
    ON public.account_balance_events
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_account_balance_event()
RETURNS TRIGGER AS $$
DECLARE
    change_amount NUMERIC;
    change_direction TEXT;
BEGIN
    IF NEW.current_balance = OLD.current_balance THEN
        RETURN NEW;
    END IF;

    change_amount := ABS(NEW.current_balance - OLD.current_balance);
    change_direction := CASE
        WHEN NEW.current_balance > OLD.current_balance THEN 'credit'
        ELSE 'debit'
    END;

    INSERT INTO public.account_balance_events (
        user_id,
        account_id,
        source_type,
        direction,
        amount,
        balance_before,
        balance_after
    )
    VALUES (
        NEW.user_id,
        NEW.id,
        'adjustment',
        change_direction,
        change_amount,
        OLD.current_balance,
        NEW.current_balance
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_account_balance_event ON public.accounts;
CREATE TRIGGER trg_account_balance_event
    AFTER UPDATE OF current_balance ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.record_account_balance_event();

-- Existing buy rows historically used quantity * price as cost basis.
-- Rebuild only the deterministic buy-side value; sell allocations remain
-- represented by their recorded cost_basis.
UPDATE public.crypto_trades
SET cost_basis = gross_amount + fee_amount
WHERE type = 'buy';

DO $$
DECLARE
    holding_record RECORD;
    trade_record RECORD;
    running_quantity NUMERIC;
    running_cost NUMERIC;
    allocated_cost NUMERIC;
BEGIN
    FOR holding_record IN
        SELECT id, user_id, account_id, symbol
        FROM public.crypto_holdings
    LOOP
        running_quantity := 0;
        running_cost := 0;

        FOR trade_record IN
            SELECT type, quantity, cost_basis
            FROM public.crypto_trades
            WHERE user_id = holding_record.user_id
              AND account_id = holding_record.account_id
              AND UPPER(symbol) = UPPER(holding_record.symbol)
            ORDER BY trade_date ASC, created_at ASC
        LOOP
            IF trade_record.type = 'buy' THEN
                running_quantity := running_quantity + trade_record.quantity;
                running_cost := running_cost + trade_record.cost_basis;
            ELSIF running_quantity > 0 THEN
                allocated_cost :=
                    (trade_record.quantity / running_quantity) * running_cost;
                running_quantity :=
                    GREATEST(0, running_quantity - trade_record.quantity);
                running_cost := GREATEST(0, running_cost - allocated_cost);
            END IF;
        END LOOP;

        IF running_quantity <= 0.000000000001 THEN
            DELETE FROM public.crypto_holdings
            WHERE id = holding_record.id;
        ELSE
            UPDATE public.crypto_holdings
            SET
                quantity = running_quantity,
                cost_basis = running_cost,
                average_buy_price = running_cost / running_quantity,
                updated_at = now()
            WHERE id = holding_record.id;
        END IF;
    END LOOP;
END;
$$;
