-- ═══════════════════════════════════════════════════════════════
-- 026 · Fix quotes.business_line — allow NULL + set default
-- The NOT NULL constraint without a default blocked every upsert
-- from the frontend, causing quotes to never sync to Supabase.
-- ═══════════════════════════════════════════════════════════════

-- Drop NOT NULL and set a sensible default
ALTER TABLE quotes ALTER COLUMN business_line SET DEFAULT 'Camperización';
ALTER TABLE quotes ALTER COLUMN business_line DROP NOT NULL;

-- Backfill any potential NULLs
UPDATE quotes SET business_line = 'Camperización' WHERE business_line IS NULL;
