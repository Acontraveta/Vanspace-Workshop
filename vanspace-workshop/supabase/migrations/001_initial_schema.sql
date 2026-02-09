-- =====================================================
-- VANSPACE WORKSHOP - INITIAL SCHEMA
-- Migration 001: Users, CRM, Quotes, Projects
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'MARKETING', 'DESIGN', 'ORDERS', 'PRODUCTION')),
  specialty VARCHAR(255),
  hourly_rate DECIMAL(10,2),
  weekly_hours INTEGER DEFAULT 40,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- CRM LEADS
-- =====================================================
CREATE TABLE crm_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  excel_row_number INTEGER,
  
  -- Datos básicos
  fecha DATE NOT NULL,
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

-- Índices CRM
CREATE INDEX idx_crm_leads_estado ON crm_leads(estado);
CREATE INDEX idx_crm_leads_asignado ON crm_leads(asignado);
CREATE INDEX idx_crm_leads_cliente ON crm_leads(cliente);

-- =====================================================
-- QUOTES (PRESUPUESTOS)
-- =====================================================
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Cliente
  lead_id UUID REFERENCES crm_leads(id),
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  
  -- Vehículo
  vehicle_model VARCHAR(255),
  vehicle_size VARCHAR(50),
  
  -- Negocio
  business_line VARCHAR(100) NOT NULL,
  urgency VARCHAR(20) DEFAULT 'MEDIA',
  
  -- Importes
  total_materials DECIMAL(10,2),
  total_labor DECIMAL(10,2),
  total_hours DECIMAL(10,2),
  profit_margin DECIMAL(5,2),
  total DECIMAL(10,2) NOT NULL,
  
  -- Estado
  status VARCHAR(50) DEFAULT 'DRAFT',
  
  -- Fechas
  sent_at TIMESTAMP,
  approved_at TIMESTAMP,
  estimated_start_date DATE,
  
  -- PDF
  pdf_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  
  catalog_sku VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  installation_hours DECIMAL(10,2),
  total_price DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices Quotes
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_client ON quotes(client_name);

-- =====================================================
-- PROJECTS
-- =====================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_number VARCHAR(50) UNIQUE NOT NULL,
  
  quote_id UUID REFERENCES quotes(id),
  lead_id UUID REFERENCES crm_leads(id),
  
  client_name VARCHAR(255) NOT NULL,
  vehicle_model VARCHAR(255),
  
  -- Planificación
  scheduled_start DATE,
  scheduled_end DATE,
  actual_start DATE,
  actual_end DATE,
  
  -- Tiempos
  estimated_minutes INTEGER,
  actual_minutes_used INTEGER DEFAULT 0,
  
  -- Estado
  status VARCHAR(50) DEFAULT 'SCHEDULED',
  progress_percentage INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices Projects
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_dates ON projects(scheduled_start, scheduled_end);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_leads_updated_at 
  BEFORE UPDATE ON crm_leads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at 
  BEFORE UPDATE ON quotes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir todo por ahora)
CREATE POLICY "Enable all for authenticated users" ON users FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON crm_leads FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON quotes FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON quote_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON projects FOR ALL TO authenticated USING (true);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Usuario admin por defecto
INSERT INTO users (email, name, role, hourly_rate, specialty) VALUES
('admin@vanspace.es', 'Admin VanSpace', 'ADMIN', 0, 'Administración');

-- Comentarios
COMMENT ON TABLE users IS 'Usuarios del sistema';
COMMENT ON TABLE crm_leads IS 'Leads del CRM sincronizados con Excel';
COMMENT ON TABLE quotes IS 'Presupuestos generados';
COMMENT ON TABLE projects IS 'Proyectos en ejecución';
