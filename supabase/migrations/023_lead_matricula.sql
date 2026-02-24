-- ═══════════════════════════════════════════════════════════════
-- 023 · CRM Lead — Vehicle license plate (matrícula)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS matricula TEXT;
