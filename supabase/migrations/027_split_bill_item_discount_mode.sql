-- Add mode for per-item discounts so AI scan (and UI) can specify percent vs nominal.
-- Existing item_discount values are nominal amounts, so default mode is 'fixed'.
alter table public.split_bill_items
  add column if not exists item_discount_mode text not null default 'fixed';

-- Keep values consistent: 'fixed' = nominal amount, 'percent' = percentage (0-100).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'split_bill_items_item_discount_mode_check'
  ) then
    alter table public.split_bill_items
      add constraint split_bill_items_item_discount_mode_check
      check (item_discount_mode in ('fixed', 'percent'));
  end if;
end $$;
