-- ═══════════════════════════════════════════════════════════════
-- 028 · Add order group & invoice fields to purchase_items
-- Enables grouping multiple purchase items into a single order
-- block and attaching invoice metadata (number, date, amount,
-- VAT, provider NIF) for fiscal reporting.
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_items') THEN
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS order_group_id       TEXT;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS invoice_number       TEXT;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS invoice_date         DATE;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS invoice_amount       NUMERIC;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS invoice_vat_pct      NUMERIC DEFAULT 21;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS invoice_vat_amount   NUMERIC;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS invoice_provider_nif TEXT;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS invoice_image_url   TEXT;

    -- Index for fast group lookups
    CREATE INDEX IF NOT EXISTS idx_purchase_items_order_group ON purchase_items(order_group_id) WHERE order_group_id IS NOT NULL;
  END IF;
END $$;
