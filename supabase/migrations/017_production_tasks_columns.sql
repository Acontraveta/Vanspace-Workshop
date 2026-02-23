-- =====================================================
-- 017: Add missing columns to production_tasks
-- and cutlist columns to furniture_work_orders
-- Run in: Supabase → SQL Editor
-- Safe to re-run (uses IF NOT EXISTS everywhere)
-- =====================================================

-- ── production_tasks: block & operator columns ─────────────────────────────────

DO $$ BEGIN
  -- Only add columns if the table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'production_tasks') THEN
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS task_block_id       TEXT;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS block_order         INTEGER;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS is_block_first      BOOLEAN DEFAULT false;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS materials_collected BOOLEAN DEFAULT false;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS catalog_sku         TEXT;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS materials           TEXT;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS consumables         TEXT;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS instructions_design TEXT;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS requiere_diseno     BOOLEAN DEFAULT false;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS tipo_diseno         TEXT;
    ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_production_tasks_block
      ON production_tasks (project_id, task_block_id);
  END IF;
END $$;

-- ── furniture_work_orders: cutlist SVG storage ─────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_work_orders') THEN
    ALTER TABLE furniture_work_orders ADD COLUMN IF NOT EXISTS cutlist_svg        TEXT;
    ALTER TABLE furniture_work_orders ADD COLUMN IF NOT EXISTS board_cutlist_svgs JSONB;
  END IF;
END $$;

-- ── furniture_designs: blueprint SVG storage ───────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_designs') THEN
    ALTER TABLE furniture_designs ADD COLUMN IF NOT EXISTS blueprint_svg TEXT;
  END IF;
END $$;
