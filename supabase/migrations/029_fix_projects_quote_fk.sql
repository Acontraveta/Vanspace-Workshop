-- ═══════════════════════════════════════════════════════════════
-- 029 · Soft-delete support for quotes
-- Instead of hard DELETE (which other devices re-upload as "offline"),
-- we set deleted_at. syncFromSupabase filters and propagates the deletion.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for fast filtering of active quotes
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON quotes(deleted_at)
  WHERE deleted_at IS NULL;
