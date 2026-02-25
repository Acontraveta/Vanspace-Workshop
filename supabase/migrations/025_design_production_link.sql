-- ═══════════════════════════════════════════════════════════════
-- 025 · Link interior/exterior designs to production projects
-- ═══════════════════════════════════════════════════════════════

-- Add production_project_id to interior_designs
ALTER TABLE interior_designs
  ADD COLUMN IF NOT EXISTS production_project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_intd_production
  ON interior_designs(production_project_id);

-- Add production_project_id to exterior_designs
ALTER TABLE exterior_designs
  ADD COLUMN IF NOT EXISTS production_project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_extd_production
  ON exterior_designs(production_project_id);
