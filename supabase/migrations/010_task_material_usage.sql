-- =====================================================
-- TASK MATERIAL USAGE
-- Tracks materials reserved and consumed per production task.
--
-- Flow:
--   Task STARTED  → insert rows with status = 'in_use'
--                   (stock_items.cantidad already decremented)
--   Task COMPLETED → update rows to status = 'consumed'
-- =====================================================

CREATE TABLE IF NOT EXISTS task_material_usage (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id       UUID         NOT NULL,
  project_id    UUID         NOT NULL,

  material_name TEXT         NOT NULL,
  referencia    TEXT,                        -- stock_items.referencia if matched
  quantity      NUMERIC      NOT NULL,
  unit          TEXT         DEFAULT 'ud',
  item_type     TEXT         NOT NULL DEFAULT 'material',  -- 'material' | 'consumable'

  status        TEXT         NOT NULL DEFAULT 'in_use',    -- 'in_use' | 'consumed'
  reserved_at   TIMESTAMPTZ  DEFAULT NOW(),
  consumed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tmu_task_id    ON task_material_usage (task_id);
CREATE INDEX IF NOT EXISTS idx_tmu_project_id ON task_material_usage (project_id);
CREATE INDEX IF NOT EXISTS idx_tmu_status     ON task_material_usage (status);

ALTER TABLE task_material_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tmu_all" ON task_material_usage;
CREATE POLICY "tmu_all" ON task_material_usage
  FOR ALL USING (true);

SELECT 'task_material_usage table ready ✅' AS status;
