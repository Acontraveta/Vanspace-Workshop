-- =====================================================
-- PURCHASE ITEMS TABLE
-- Replaces localStorage('purchase_items')
-- Run in: Supabase → SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_items (
  id              TEXT          PRIMARY KEY,
  project_id      TEXT,
  project_number  TEXT,
  referencia      TEXT,
  material_name   TEXT          NOT NULL,
  quantity        NUMERIC       NOT NULL DEFAULT 0,
  unit            TEXT          NOT NULL DEFAULT 'ud',
  provider        TEXT,
  delivery_days   INTEGER       DEFAULT 7,
  priority        INTEGER       NOT NULL DEFAULT 5,
  product_sku     TEXT,
  product_name    TEXT,
  status          TEXT          NOT NULL DEFAULT 'PENDING',
  -- 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  ordered_at      TIMESTAMPTZ,
  received_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_items_status      ON purchase_items (status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_project_id  ON purchase_items (project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_priority    ON purchase_items (priority DESC);

-- RLS
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_items_all" ON purchase_items;
CREATE POLICY "purchase_items_all" ON purchase_items FOR ALL USING (true);
