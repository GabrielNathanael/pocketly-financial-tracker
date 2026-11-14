-- Idempotency key for manual split bill draft creation.
-- Prevents duplicate draft rows when the client retries/remounts (e.g. StrictMode dev,
-- network retries, interrupted navigation) for the same "start manual" attempt.
ALTER TABLE public.split_bills
  ADD COLUMN IF NOT EXISTS manual_draft_key UUID;

-- Allow many normal bills/drafts without a key, but enforce at-most-once per user+attempt key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_bills_user_manual_draft_key
  ON public.split_bills (user_id, manual_draft_key)
  WHERE manual_draft_key IS NOT NULL;

COMMENT ON COLUMN public.split_bills.manual_draft_key IS
  'Client-generated attempt key for idempotent manual draft creation; NULL for non-manual/legacy drafts.';
