-- 023: Settlement currency follows account currency for all investment assets.
-- Stocks/ETFs/Crypto record amounts in the settlement currency of the account
-- used for the trade (IDR or USD). Market prices remain native in asset_prices.

-- Stock
ALTER TABLE public.stock_holdings
  ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE public.stock_trades
  ADD COLUMN IF NOT EXISTS currency TEXT;

UPDATE public.stock_holdings h
SET currency = COALESCE(a.currency, 'IDR')
FROM public.accounts a
WHERE a.id = h.account_id AND h.currency IS NULL;

UPDATE public.stock_trades t
SET currency = COALESCE(a.currency, 'IDR')
FROM public.accounts a
WHERE a.id = t.account_id AND t.currency IS NULL;

UPDATE public.stock_holdings SET currency = 'IDR' WHERE currency IS NULL;
UPDATE public.stock_trades SET currency = 'IDR' WHERE currency IS NULL;

ALTER TABLE public.stock_holdings
  ALTER COLUMN currency SET DEFAULT 'IDR',
  ALTER COLUMN currency SET NOT NULL;

ALTER TABLE public.stock_trades
  ALTER COLUMN currency SET DEFAULT 'IDR',
  ALTER COLUMN currency SET NOT NULL;

-- ETF
ALTER TABLE public.etf_holdings
  ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE public.etf_trades
  ADD COLUMN IF NOT EXISTS currency TEXT;

UPDATE public.etf_holdings h
SET currency = COALESCE(a.currency, 'IDR')
FROM public.accounts a
WHERE a.id = h.account_id AND h.currency IS NULL;

UPDATE public.etf_trades t
SET currency = COALESCE(a.currency, 'IDR')
FROM public.accounts a
WHERE a.id = t.account_id AND t.currency IS NULL;

UPDATE public.etf_holdings SET currency = 'IDR' WHERE currency IS NULL;
UPDATE public.etf_trades SET currency = 'IDR' WHERE currency IS NULL;

ALTER TABLE public.etf_holdings
  ALTER COLUMN currency SET DEFAULT 'IDR',
  ALTER COLUMN currency SET NOT NULL;

ALTER TABLE public.etf_trades
  ALTER COLUMN currency SET DEFAULT 'IDR',
  ALTER COLUMN currency SET NOT NULL;

-- Crypto: trades get explicit settlement currency for gross/price/cost amounts.
-- Holdings already have price_currency as the cost/settlement currency.
ALTER TABLE public.crypto_trades
  ADD COLUMN IF NOT EXISTS currency TEXT;

UPDATE public.crypto_trades t
SET currency = COALESCE(a.currency, t.fee_currency, 'IDR')
FROM public.accounts a
WHERE a.id = t.account_id AND t.currency IS NULL;

UPDATE public.crypto_trades SET currency = COALESCE(fee_currency, 'IDR') WHERE currency IS NULL;

ALTER TABLE public.crypto_trades
  ALTER COLUMN currency SET DEFAULT 'IDR',
  ALTER COLUMN currency SET NOT NULL;

-- Align existing crypto holding cost currency to the holding's account currency
-- (source of truth for settlement). Safe for current data (all IDR).
UPDATE public.crypto_holdings h
SET price_currency = COALESCE(a.currency, h.price_currency, 'IDR')
FROM public.accounts a
WHERE a.id = h.account_id;