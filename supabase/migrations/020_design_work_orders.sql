-- ═══════════════════════════════════════════════════════════════
-- 020 · Extend work orders for all design types (exterior + interior)
-- ═══════════════════════════════════════════════════════════════

-- ── Add design_type column to existing furniture_work_orders ─────
-- Values: 'furniture' | 'exterior' | 'interior'
ALTER TABLE furniture_work_orders
  ADD COLUMN IF NOT EXISTS design_type TEXT NOT NULL DEFAULT 'furniture';

CREATE INDEX IF NOT EXISTS idx_fwo_design_type ON furniture_work_orders(design_type);

-- ── Exterior Designs ─────────────────────────────────────────────
-- Stores the placed elements for a van exterior design linked to a WO.
CREATE TABLE IF NOT EXISTS exterior_designs (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  work_order_id     TEXT REFERENCES furniture_work_orders(id) ON DELETE CASCADE,
  project_id        TEXT,
  elements          JSONB NOT NULL DEFAULT '[]',  -- PlacedElement[]
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extd_work_order ON exterior_designs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_extd_project    ON exterior_designs(project_id);

ALTER TABLE exterior_designs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'exterior_designs' AND policyname = 'extd_open'
  ) THEN
    CREATE POLICY "extd_open" ON exterior_designs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Interior Designs ─────────────────────────────────────────────
-- Stores the placed items for a van interior design linked to a WO.
CREATE TABLE IF NOT EXISTS interior_designs (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  work_order_id     TEXT REFERENCES furniture_work_orders(id) ON DELETE CASCADE,
  project_id        TEXT,
  items             JSONB NOT NULL DEFAULT '[]',  -- InteriorItem[]
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intd_work_order ON interior_designs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_intd_project    ON interior_designs(project_id);

ALTER TABLE interior_designs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'interior_designs' AND policyname = 'intd_open'
  ) THEN
    CREATE POLICY "intd_open" ON interior_designs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
