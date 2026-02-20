-- ═══════════════════════════════════════════════════════════════
-- 013 · Material catalog for furniture designer
-- Stores available materials (wood, melamine, etc.) that can
-- be assigned to individual panels in a furniture design.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS material_catalog (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  thickness       NUMERIC NOT NULL DEFAULT 16,        -- mm
  price_per_m2    NUMERIC NOT NULL DEFAULT 0,         -- €/m²
  color_hex       TEXT NOT NULL DEFAULT '#888888',     -- hex colour for 2D/3D rendering
  texture_label   TEXT NOT NULL DEFAULT '',            -- short label e.g. "Roble"
  category        TEXT NOT NULL DEFAULT 'otro',        -- madera | melamina | contrachapado | dm | hpl | otro
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

-- ── Seed with default materials ──────────────────────────────────────────────

INSERT INTO material_catalog (id, name, thickness, price_per_m2, color_hex, texture_label, category, in_stock)
VALUES
  ('mat-chopo-16',    'Contrachapado Chopo 16mm',    16, 42,  '#c4a882', 'Chopo',    'contrachapado', true),
  ('mat-chopo-18',    'Contrachapado Chopo 18mm',    18, 50,  '#b89b72', 'Chopo',    'contrachapado', true),
  ('mat-abedul-12',   'Contrachapado Abedul 12mm',   12, 55,  '#e8d5b7', 'Abedul',   'contrachapado', true),
  ('mat-abedul-18',   'Contrachapado Abedul 18mm',   18, 72,  '#d4be96', 'Abedul',   'contrachapado', true),
  ('mat-dm-hidro-16', 'DM hidrófugo 16mm',           16, 35,  '#8b7355', 'DM Hidro', 'dm',            true),
  ('mat-hpl-blanco',  'HPL Blanco',                  16, 95,  '#f0f0f0', 'Blanco',   'hpl',           true),
  ('mat-mel-blanco',  'Melamina Blanco Brillo 16mm', 16, 28,  '#ffffff', 'Blanco',   'melamina',      true),
  ('mat-mel-gris',    'Melamina Gris Claro 16mm',    16, 30,  '#b0b0b0', 'Gris',     'melamina',      true),
  ('mat-mel-roble',   'Melamina Roble Natural 16mm', 16, 32,  '#ba8c5c', 'Roble',    'melamina',      true),
  ('mat-mel-nogal',   'Melamina Nogal 16mm',         16, 34,  '#5e3a22', 'Nogal',    'melamina',      true),
  ('mat-mel-negro',   'Melamina Negro Mate 16mm',    16, 32,  '#2a2a2a', 'Negro',    'melamina',      true),
  ('mat-pino-18',     'Pino macizo 18mm',            18, 48,  '#d4b896', 'Pino',     'madera',        true),
  ('mat-roble-20',    'Roble macizo 20mm',           20, 120, '#a07040', 'Roble',    'madera',        false)
ON CONFLICT (id) DO NOTHING;
