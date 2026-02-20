-- ═══════════════════════════════════════════════════════════════
-- 016 · Add stock tracking columns to material_catalog
-- Links catalog materials to the stock system and purchases
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS stock_quantity  NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS stock_min       NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS supplier        TEXT;
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS board_width     NUMERIC NOT NULL DEFAULT 2440;
ALTER TABLE material_catalog ADD COLUMN IF NOT EXISTS board_height    NUMERIC NOT NULL DEFAULT 1220;

-- Index for quick low-stock queries
CREATE INDEX IF NOT EXISTS idx_material_catalog_low_stock
  ON material_catalog (stock_quantity)
  WHERE stock_min > 0 AND stock_quantity < stock_min;

COMMENT ON COLUMN material_catalog.stock_quantity IS 'Number of sheets/boards currently in stock';
COMMENT ON COLUMN material_catalog.stock_min      IS 'Minimum stock threshold — auto-purchase when below';
COMMENT ON COLUMN material_catalog.supplier       IS 'Preferred supplier for auto-purchase orders';
COMMENT ON COLUMN material_catalog.board_width    IS 'Standard sheet width in mm (default 2440)';
COMMENT ON COLUMN material_catalog.board_height   IS 'Standard sheet height in mm (default 1220)';
