-- =====================================================
-- UNIFIED CALENDAR EVENTS TABLE
-- Stores CRM appointments, manual events, reminders.
-- Production projects are fetched live from production_projects.
-- Purchases are fetched live from purchase_items.
-- Run in: Supabase → SQL Editor
-- =====================================================

-- Drop and recreate cleanly (safe: no data yet)
DROP TABLE IF EXISTS calendar_events CASCADE;

CREATE TABLE calendar_events (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  title          VARCHAR(255)  NOT NULL,
  description    TEXT,
  event_date     DATE          NOT NULL,
  end_date       DATE,
  event_time     TIME,
  branch         VARCHAR(50)   NOT NULL DEFAULT 'general',
  -- 'produccion' | 'crm' | 'pedidos' | 'presupuestos' | 'general'
  event_type     VARCHAR(50),
  -- CRM:         'RECEPCION' | 'ENTREGA' | 'REVISION' | 'CITA'
  -- Pedidos:     'ENTREGA_ESPERADA' | 'SEGUIMIENTO'
  -- Presupuesto: 'SEGUIMIENTO' | 'VENCIMIENTO'
  -- General:     'REUNION' | 'RECORDATORIO' | 'NOTA'
  source_id      VARCHAR(255),    -- foreign key to source record
  metadata       JSONB         DEFAULT '{}',
  created_by     VARCHAR(255),
  visible_roles  TEXT[]        DEFAULT ARRAY['admin','encargado','encargado_taller','compras','operario'],
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_date     ON calendar_events (event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_branch   ON calendar_events (branch);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source   ON calendar_events (source_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_calendar_events_updated_at();

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_events_all" ON calendar_events;
CREATE POLICY "calendar_events_all" ON calendar_events
  FOR ALL USING (true);

-- Sample default events (optional — remove if not wanted)
-- INSERT INTO calendar_events (title, description, date, branch, event_type, visible_roles)
-- VALUES ('Evento de prueba', 'Descripción del evento', CURRENT_DATE, 'general', 'NOTA', ARRAY['admin']);

SELECT 'Unified calendar_events table ready ✅' AS status;
