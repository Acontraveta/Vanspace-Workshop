-- ═══════════════════════════════════════════════════════════════
-- 029 · Ensure no FK constraints block quote deletion
-- The tables projects / quote_items from migration 001 were never
-- created in practice. This migration is a safe no-op guard that
-- drops any FK referencing quotes(id) if it ever appears.
-- ═══════════════════════════════════════════════════════════════

-- Guard: only act if the table actually exists
DO $$ BEGIN
  -- projects table (from 001, never deployed)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
    ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_quote_id_fkey;
    ALTER TABLE projects
      ADD CONSTRAINT projects_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;

  -- quote_items table (from 001, never deployed — items stored as JSONB in quotes)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_items') THEN
    ALTER TABLE quote_items DROP CONSTRAINT IF EXISTS quote_items_quote_id_fkey;
    ALTER TABLE quote_items
      ADD CONSTRAINT quote_items_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;
  END IF;
END $$;
