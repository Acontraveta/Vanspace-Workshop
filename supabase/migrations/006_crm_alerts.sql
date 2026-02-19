-- =====================================================
-- CRM ALERT SYSTEM
-- Run in: Supabase → SQL Editor
-- =====================================================

-- 1. Extend alert_settings with CRM-specific columns
ALTER TABLE alert_settings
  ADD COLUMN IF NOT EXISTS nombre         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS descripcion    TEXT,
  ADD COLUMN IF NOT EXISTS icono          VARCHAR(50) DEFAULT '🔔',
  ADD COLUMN IF NOT EXISTS dias_umbral    INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS roles_destino  TEXT[] DEFAULT ARRAY['admin', 'encargado', 'compras'],
  ADD COLUMN IF NOT EXISTS prioridad      VARCHAR(20) DEFAULT 'media';

-- 1b. Ensure alert_settings has a primary key on tipo_alerta
-- (it probably already has one but just in case)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alert_settings_pkey'
  ) THEN
    ALTER TABLE alert_settings ADD PRIMARY KEY (tipo_alerta);
  END IF;
END$$;

-- 2. Insert default CRM alert configs
INSERT INTO alert_settings
  (tipo_alerta, nombre, descripcion, icono, activa, dias_umbral, roles_destino, prioridad, destinatario)
VALUES
  (
    'presupuesto_caducando',
    'Presupuesto sin respuesta',
    'Hay un presupuesto enviado hace más de X días sin aprobación ni rechazo',
    '📄', true, 30,
    ARRAY['admin', 'compras', 'encargado'],
    'alta', 'admin'
  ),
  (
    'llamada_calidad',
    'Llamada de control de calidad',
    'Han pasado X días desde la entrega del vehículo — momento para llamar al cliente',
    '📞', true, 14,
    ARRAY['admin', 'compras', 'encargado'],
    'media', 'admin'
  ),
  (
    'revision_programada',
    'Revisión programada próxima',
    'Quedan menos de X días para una acción programada con el cliente',
    '🔧', true, 7,
    ARRAY['admin', 'compras', 'encargado'],
    'media', 'admin'
  ),
  (
    'sin_actividad',
    'Lead sin actividad',
    'Un lead activo lleva más de X días sin actualización en el pipeline',
    '😴', true, 30,
    ARRAY['admin', 'compras'],
    'baja', 'admin'
  ),
  (
    'fecha_accion_vencida',
    'Acción pendiente vencida',
    'La fecha de próxima acción de un lead ya ha pasado',
    '⏰', true, 0,
    ARRAY['admin', 'compras', 'encargado'],
    'alta', 'admin'
  ),
  (
    'seguimiento_negociacion',
    'Seguimiento en negociación',
    'Un lead en negociación lleva más de X días sin contacto registrado',
    '🤝', true, 7,
    ARRAY['admin', 'compras'],
    'media', 'admin'
  )
ON CONFLICT (tipo_alerta) DO UPDATE
  SET nombre        = EXCLUDED.nombre,
      descripcion   = EXCLUDED.descripcion,
      icono         = EXCLUDED.icono,
      dias_umbral   = COALESCE(alert_settings.dias_umbral, EXCLUDED.dias_umbral),
      roles_destino = COALESCE(alert_settings.roles_destino, EXCLUDED.roles_destino),
      prioridad     = COALESCE(alert_settings.prioridad, EXCLUDED.prioridad);

-- 3. Create crm_alert_instances table
CREATE TABLE IF NOT EXISTS crm_alert_instances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_alerta     VARCHAR(100) NOT NULL,
  lead_id         UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  titulo          VARCHAR(255),
  descripcion     TEXT,
  prioridad       VARCHAR(20) DEFAULT 'media',
  roles_destino   TEXT[] DEFAULT ARRAY['admin'],
  estado          VARCHAR(20) DEFAULT 'pendiente',
  fecha_generada  TIMESTAMP DEFAULT NOW(),
  resuelta_por    VARCHAR(255),
  resuelta_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (tipo_alerta, lead_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_crm_alert_instances_estado      ON crm_alert_instances(estado);
CREATE INDEX IF NOT EXISTS idx_crm_alert_instances_tipo        ON crm_alert_instances(tipo_alerta);
CREATE INDEX IF NOT EXISTS idx_crm_alert_instances_lead        ON crm_alert_instances(lead_id);

-- 5. RLS
ALTER TABLE crm_alert_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_crm_alert_instances" ON crm_alert_instances;
CREATE POLICY "allow_all_crm_alert_instances"
  ON crm_alert_instances FOR ALL
  USING (true) WITH CHECK (true);

SELECT 'CRM alert system ready ✅' AS status;
