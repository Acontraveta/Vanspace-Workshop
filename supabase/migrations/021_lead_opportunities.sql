-- ═══════════════════════════════════════════════════════════════
-- 021 · CRM Lead Opportunities (multiple commercial states per lead)
-- ═══════════════════════════════════════════════════════════════
-- A returning client can go through the pipeline multiple times.
-- Each completed cycle is archived into the `oportunidades` JSONB array,
-- and the lead's main estado/importe/linea_negocio reset to 'Nuevo'.

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS oportunidades JSONB NOT NULL DEFAULT '[]';

-- Example structure for each entry in oportunidades:
-- {
--   "id": "opp-1708000000000",
--   "estado": "Entregado",
--   "importe": 12500,
--   "linea_negocio": "Camperización completa",
--   "vehiculo": "Sprinter L3H3",
--   "notas": "...",
--   "fecha_inicio": "2025-03-15",
--   "fecha_entrega": "2025-06-20",
--   "satisfaccion": "5 ★",
--   "created_at": "2025-06-20T12:00:00Z"
-- }
