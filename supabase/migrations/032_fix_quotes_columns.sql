-- ═══════════════════════════════════════════════════════════════
-- 032 · Fix quotes table — ensure all columns match app expectations
--
-- Migration 001 created: total_materials, total_labor
-- Migration 011 created: subtotal_materials, subtotal_labor, subtotal, profit_amount
-- If 001 ran first, the 011 "ADD COLUMN IF NOT EXISTS" would add
-- subtotal_materials/subtotal_labor alongside the old ones but the
-- old columns prevent upsert from working when the app sends the new names.
-- This migration ensures all expected columns exist + adds document_data.
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- Ensure all columns the app sends via upsert exist
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal_materials  NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal_labor      NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal            NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS profit_margin       NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS profit_amount       NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_hours         NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS valid_until         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 days');
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes              TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS document_data      JSONB;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_at         TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS billing_data       JSONB;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tarifa             JSONB NOT NULL DEFAULT '{}';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS items              JSONB NOT NULL DEFAULT '[]';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vehicle_size       TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vehicle_model      TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_email       TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_phone       TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_id            TEXT;

-- business_line: allow NULL (migration 026 may not have run)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS business_line      TEXT;
ALTER TABLE quotes ALTER COLUMN business_line DROP NOT NULL;
ALTER TABLE quotes ALTER COLUMN business_line SET DEFAULT 'Camperización';

-- Drop FK on lead_id if it references crm_leads (migration 001 created UUID FK)
-- The app stores lead IDs as plain text, so FK may block inserts
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'quotes' AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%lead%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE quotes DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'quotes' AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%lead%'
      LIMIT 1
    );
  END IF;
END $$;

-- Drop NOT NULL on quote_number UNIQUE if it conflicts (001 uses it, 011 doesn't)
-- No harm; the app always generates quote numbers.
DO $$ BEGIN
  -- If id is UUID type from 001, alter to TEXT (Supabase upsert sends text IDs)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    -- Can't ALTER PK type with data in place; just ensure the text IDs work
    -- UUID type accepts UUID-formatted strings, which the app generates
    RAISE NOTICE 'quotes.id is UUID type — app UUID strings should still work';
  END IF;
END $$;

-- RLS — ensure policy exists with WITH CHECK
DO $$ BEGIN
  DROP POLICY IF EXISTS "quotes_open" ON quotes;
  CREATE POLICY "quotes_open" ON quotes FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Grants
GRANT ALL ON quotes TO anon, authenticated;

SELECT '✅ Migration 032: quotes columns fixed' AS status;
