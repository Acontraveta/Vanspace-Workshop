-- ═══════════════════════════════════════════════════════════════
-- 033 · Fix quotes status CHECK constraint
--
-- The constraint quotes_status_check only allows:
--   DRAFT, SENT, APPROVED, REJECTED, EXPIRED
-- but the app now uses ALBARAN as an intermediate state
-- between DRAFT and APPROVED (albarán → factura flow).
--
-- This migration drops the old constraint and recreates it
-- with ALBARAN included.
-- ═══════════════════════════════════════════════════════════════

-- Drop ALL check constraints on the status column
DO $$ 
DECLARE
  cname TEXT;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'quotes'::regclass
      AND att.attname = 'status'
      AND con.contype = 'c'   -- check constraint
  LOOP
    EXECUTE 'ALTER TABLE quotes DROP CONSTRAINT ' || quote_ident(cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  END LOOP;
END $$;

-- Recreate with all valid statuses
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'ALBARAN'));

SELECT '✅ Migration 033: quotes_status_check updated (ALBARAN added)' AS status;
