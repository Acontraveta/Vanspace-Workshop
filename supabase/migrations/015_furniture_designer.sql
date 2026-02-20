-- ═══════════════════════════════════════════════════════════════
-- 015 · Furniture Designer — work orders & saved designs
-- ═══════════════════════════════════════════════════════════════

-- ── Furniture Work Orders ────────────────────────────────────────
-- Created by automation when a quote with muebles is approved.
CREATE TABLE IF NOT EXISTS furniture_work_orders (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id       TEXT NOT NULL,
  project_task_id  TEXT,
  lead_id          TEXT,
  quote_number     TEXT NOT NULL,
  client_name      TEXT NOT NULL,
  items            JSONB NOT NULL DEFAULT '[]',
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending | in_progress | completed
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fwo_project   ON furniture_work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_fwo_task      ON furniture_work_orders(project_task_id);
CREATE INDEX IF NOT EXISTS idx_fwo_lead      ON furniture_work_orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_fwo_status    ON furniture_work_orders(status);

ALTER TABLE furniture_work_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'furniture_work_orders' AND policyname = 'fwo_open'
  ) THEN
    CREATE POLICY "fwo_open" ON furniture_work_orders FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── Furniture Designs ────────────────────────────────────────────
-- One row per saved furniture piece design (linked to lead & work order item).
CREATE TABLE IF NOT EXISTS furniture_designs (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  work_order_id     TEXT REFERENCES furniture_work_orders(id) ON DELETE CASCADE,
  lead_id           TEXT,
  project_task_id   TEXT,
  quote_item_name   TEXT NOT NULL,
  quote_item_sku    TEXT,
  module            JSONB NOT NULL DEFAULT '{}',   -- ModuleDimensions
  pieces            JSONB NOT NULL DEFAULT '[]',   -- InteractivePiece[]
  optimized_cuts    JSONB NOT NULL DEFAULT '[]',   -- PlacedPiece[]
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fd_work_order  ON furniture_designs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_fd_lead        ON furniture_designs(lead_id);
CREATE INDEX IF NOT EXISTS idx_fd_task        ON furniture_designs(project_task_id);

ALTER TABLE furniture_designs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'furniture_designs' AND policyname = 'fd_open'
  ) THEN
    CREATE POLICY "fd_open" ON furniture_designs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
