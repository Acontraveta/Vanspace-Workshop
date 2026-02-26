-- ═══════════════════════════════════════════════════════════════
-- 029 · Fix projects.quote_id FK to allow quote deletion
-- The original FK has implicit RESTRICT which blocks DELETE on quotes.
-- Change to ON DELETE SET NULL so deleting a quote just nullifies the reference.
-- ═══════════════════════════════════════════════════════════════

-- Drop the old constraint (name from pg convention: projects_quote_id_fkey)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_quote_id_fkey;

-- Re-add with ON DELETE SET NULL
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'quote_id'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;
