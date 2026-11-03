-- Distinguish the requested order amount from the amount actually settled.
-- gross_amount remains the settlement amount used for cash and cost basis.
ALTER TABLE public.crypto_trades
    ADD COLUMN IF NOT EXISTS requested_amount NUMERIC;

UPDATE public.crypto_trades
SET requested_amount = gross_amount
WHERE requested_amount IS NULL;

ALTER TABLE public.crypto_trades
    ALTER COLUMN requested_amount SET DEFAULT 0;

ALTER TABLE public.crypto_trades
    ALTER COLUMN requested_amount SET NOT NULL;

ALTER TABLE public.crypto_trades
    ADD CONSTRAINT crypto_trades_requested_amount_positive
    CHECK (requested_amount > 0);
