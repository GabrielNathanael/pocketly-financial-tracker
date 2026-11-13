-- 028: Remove color column from categories table.
-- Category colors are no longer used in the application (UI/data model simplified).

ALTER TABLE public.categories DROP COLUMN IF EXISTS color;
