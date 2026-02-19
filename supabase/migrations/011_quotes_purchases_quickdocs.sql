-- ═══════════════════════════════════════════════════════════════
-- 011 · Migrate quotes, purchases and quick_docs to Supabase
-- All business data that was previously in localStorage
-- ═══════════════════════════════════════════════════════════════

-- ── Quotes ──────────────────────────────────────────────────────
-- Create the table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS quotes (
  id                  TEXT PRIMARY KEY,
  quote_number        TEXT NOT NULL,
  client_name         TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'DRAFT',
  total               NUMERIC NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add all columns that may be missing (safe if they already exist)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_id           TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_email      TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_phone      TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vehicle_model     TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vehicle_size      TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS billing_data      JSONB;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tarifa            JSONB NOT NULL DEFAULT '{}';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS items             JSONB NOT NULL DEFAULT '[]';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal_materials NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal_labor    NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal          NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS profit_margin     NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS profit_amount     NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_hours       NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS valid_until       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 days');
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes             TEXT;

CREATE INDEX IF NOT EXISTS idx_quotes_status    ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id   ON quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created   ON quotes(created_at DESC);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'quotes_open'
  ) THEN
    CREATE POLICY "quotes_open" ON quotes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── Purchases (table alias — actual app uses purchase_items from 012) ────────
-- Kept for reference; all app code uses purchase_items table instead.

-- ── Quick docs (facturas simplificadas + proformas) ────────────
CREATE TABLE IF NOT EXISTS quick_docs (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,          -- 'FACTURA_SIMPLIFICADA' | 'PROFORMA'
  doc_number   TEXT NOT NULL UNIQUE,
  doc_date     DATE NOT NULL,
  client_name  TEXT NOT NULL,
  client_nif   TEXT,
  lines        JSONB NOT NULL DEFAULT '[]',
  vat_pct      NUMERIC NOT NULL DEFAULT 21,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  subtotal     NUMERIC NOT NULL DEFAULT 0,
  vat_amount   NUMERIC NOT NULL DEFAULT 0,
  total        NUMERIC NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quick_docs_type    ON quick_docs(type);
CREATE INDEX IF NOT EXISTS idx_quick_docs_created ON quick_docs(created_at DESC);

ALTER TABLE quick_docs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quick_docs' AND policyname = 'quick_docs_open'
  ) THEN
    CREATE POLICY "quick_docs_open" ON quick_docs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
