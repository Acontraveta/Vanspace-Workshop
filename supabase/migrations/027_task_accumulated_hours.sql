-- ═══════════════════════════════════════════════════════════════
-- 027 · Add accumulated_hours to production_tasks
-- When an operator pauses a task, the current period's hours are
-- saved to accumulated_hours. On resume, started_at is reset but
-- accumulated_hours is preserved. On complete, total = accumulated
-- + current period.
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_tasks') THEN
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS accumulated_hours NUMERIC DEFAULT 0;
  END IF;
END $$;
