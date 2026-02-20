-- ═══════════════════════════════════════════════════════════════
-- 016 · Material catalog with stock tracking
-- Creates the table if missing (013 may not have run) then
-- adds stock columns for inventory + auto-purchase integration.
-- ═══════════════════════════════════════════════════════════════

-- Create the table first if it doesn't exist (safe if 013 already ran)
CREATE TABLE IF NOT EXISTS material_catalog (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  thickness       NUMERIC NOT NULL DEFAULT 16,
  price_per_m2    NUMERIC NOT NULL DEFAULT 0,
  color_hex       TEXT NOT NULL DEFAULT '#888888',
  texture_label   TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'otro',
  in_stock        BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_catalog_category   ON material_catalog(category);
CREATE INDEX IF NOT EXISTS idx_material_catalog_in_stock   ON material_catalog(in_stock);

ALTER TABLE material_catalog ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'material_catalog' AND policyname = 'material_catalog_open'
  ) THEN
    CREATE POLICY "material_catalog_open" ON material_catalog FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Stock tracking columns
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS stock_quantity  NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS stock_min       NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS supplier        TEXT;
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS board_width     NUMERIC NOT NULL DEFAULT 2440;
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS board_height    NUMERIC NOT NULL DEFAULT 1220;

-- Index for quick low-stock queries
CREATE INDEX IF NOT EXISTS idx_material_catalog_low_stock
  ON material_catalog (stock_quantity)
  WHERE stock_min > 0 AND stock_quantity < stock_min;

-- Seed default materials (skip if rows exist)
INSERT INTO material_catalog (id, name, thickness, price_per_m2, color_hex, texture_label, category, in_stock, stock_quantity, stock_min)
VALUES
  ('mat-chopo-16',    'Contrachapado Chopo 16mm',    16, 42,  '#c4a882', 'Chopo',    'contrachapado', true, 10, 3),
  ('mat-chopo-18',    'Contrachapado Chopo 18mm',    18, 50,  '#b89b72', 'Chopo',    'contrachapado', true, 8,  3),
  ('mat-abedul-12',   'Contrachapado Abedul 12mm',   12, 55,  '#e8d5b7', 'Abedul',   'contrachapado', true, 6,  2),
  ('mat-abedul-18',   'Contrachapado Abedul 18mm',   18, 72,  '#d4be96', 'Abedul',   'contrachapado', true, 5,  2),
  ('mat-dm-hidro-16', 'DM hidrófugo 16mm',           16, 35,  '#8b7355', 'DM Hidro', 'dm',            true, 12, 4),
  ('mat-hpl-blanco',  'HPL Blanco',                  16, 95,  '#f0f0f0', 'Blanco',   'hpl',           true, 4,  2),
  ('mat-mel-blanco',  'Melamina Blanco Brillo 16mm', 16, 28,  '#ffffff', 'Blanco',   'melamina',      true, 15, 5),
  ('mat-mel-gris',    'Melamina Gris Claro 16mm',    16, 30,  '#b0b0b0', 'Gris',     'melamina',      true, 10, 3),
  ('mat-mel-roble',   'Melamina Roble Natural 16mm', 16, 32,  '#ba8c5c', 'Roble',    'melamina',      true, 10, 3),
  ('mat-mel-nogal',   'Melamina Nogal 16mm',         16, 34,  '#5e3a22', 'Nogal',    'melamina',      true, 8,  3),
  ('mat-mel-negro',   'Melamina Negro Mate 16mm',    16, 32,  '#2a2a2a', 'Negro',    'melamina',      true, 6,  2),
  ('mat-pino-18',     'Pino macizo 18mm',            18, 48,  '#d4b896', 'Pino',     'madera',        true, 5,  2),
  ('mat-roble-20',    'Roble macizo 20mm',           20, 120, '#a07040', 'Roble',    'madera',        false, 0, 2)
ON CONFLICT (id) DO NOTHING;
