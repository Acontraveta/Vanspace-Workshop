-- ═══════════════════════════════════════════════════════════════
-- 026 · Add attachments column to purchase_items
-- ═══════════════════════════════════════════════════════════════

-- Stores JSON array of Supabase Storage URLs (albaranes, facturas, etc.)
ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS attachments TEXT;
