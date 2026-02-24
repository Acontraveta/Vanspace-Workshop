-- ═══════════════════════════════════════════════════════════════
-- 022 · CRM Lead — Vehicle reception tracking
-- ═══════════════════════════════════════════════════════════════
-- Three-state flow:
--   1. Programar recepción  → sets fecha_recepcion / hora_recepcion
--   2. Confirmar recepción  → sets recepcion_confirmada = true
--   3. Badge "Vehículo recibido ✓"

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS fecha_recepcion DATE,
  ADD COLUMN IF NOT EXISTS hora_recepcion  TEXT,
  ADD COLUMN IF NOT EXISTS recepcion_confirmada BOOLEAN NOT NULL DEFAULT false;
