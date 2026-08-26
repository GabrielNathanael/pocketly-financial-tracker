-- ==============================================================================
-- 008_TRANSACTION_TAGS.SQL
-- Add tags system support to transactions
-- ==============================================================================

-- 1. Add tags array column to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- 2. GIN Index for blazing-fast array searching and filtering
CREATE INDEX IF NOT EXISTS idx_transactions_tags ON public.transactions USING GIN (tags);
