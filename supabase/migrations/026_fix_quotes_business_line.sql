-- ═══════════════════════════════════════════════════════════════
-- 026 · Fix quotes.business_line — allow NULL + set default
-- The NOT NULL constraint without a default blocked every upsert
-- from the frontend, causing quotes to never sync to Supabase.
-- ═══════════════════════════════════════════════════════════════

-- If business_line doesn't exist, add it as TEXT
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS business_line TEXT;

-- If it exists as json/jsonb, convert to TEXT
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'business_line'
      AND data_type IN ('json','jsonb')
  ) THEN
    ALTER TABLE quotes ALTER COLUMN business_line TYPE TEXT USING business_line::text;
  END IF;
END $$;

ALTER TABLE quotes ALTER COLUMN business_line SET DEFAULT 'Camperización';
ALTER TABLE quotes ALTER COLUMN business_line DROP NOT NULL;

UPDATE quotes SET business_line = 'Camperización' WHERE business_line IS NULL OR business_line = '';
