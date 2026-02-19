-- =====================================================
-- RUN THIS IN: Supabase → SQL Editor
-- Creates the crm_leads table if it doesn't exist yet
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  excel_row_number INTEGER,

  -- Datos básicos
  fecha DATE,
  mes VARCHAR(20),
  asignado VARCHAR(255),
  cliente VARCHAR(255) NOT NULL,
  telefono VARCHAR(50),
  email VARCHAR(255),
  localidad VARCHAR(255),

  -- Vehículo
  origen VARCHAR(100),
  vehiculo VARCHAR(255),
  talla VARCHAR(50),
  viaj_dorm VARCHAR(50),

  -- Negocio
  linea_negocio VARCHAR(100),
  estado VARCHAR(50),
  importe DECIMAL(10,2),

  -- Seguimiento
  proxima_accion TEXT,
  fecha_accion DATE,
  notas TEXT,

  -- Entrega y calidad
  fecha_entrega DATE,
  satisfaccion VARCHAR(100),
  incidencias TEXT,
  resena TEXT,

  -- Localización
  provincia VARCHAR(100),
  region VARCHAR(100),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP
);

-- Unique constraint needed for upsert by excel_row_number
ALTER TABLE crm_leads
  DROP CONSTRAINT IF EXISTS crm_leads_excel_row_number_key;

ALTER TABLE crm_leads
  ADD CONSTRAINT crm_leads_excel_row_number_key
  UNIQUE (excel_row_number);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_leads_estado    ON crm_leads(estado);
CREATE INDEX IF NOT EXISTS idx_crm_leads_asignado  ON crm_leads(asignado);
CREATE INDEX IF NOT EXISTS idx_crm_leads_cliente   ON crm_leads(cliente);

-- Allow anon/authenticated reads and writes (adjust RLS to taste)
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_crm" ON crm_leads;

CREATE POLICY "allow_all_crm"
  ON crm_leads
  FOR ALL
  USING (true)
  WITH CHECK (true);

SELECT 'crm_leads table ready ✅' AS status;
