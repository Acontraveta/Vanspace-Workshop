-- ═══════════════════════════════════════════════════════════════
-- 030 · Create all missing tables required by the application
--
-- These tables are heavily used by dashboard services
-- (ProductionService, ConfigService, StockService, etc.)
-- but were never formally tracked in a migration file.
--
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS everywhere.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. production_projects
--    Used by: ProductionService.getProjects()
--    Dashboards: AdminDashboard, EncargadoDashboard,
--               EncargadoTallerDashboard
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_projects (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  quote_id            TEXT,
  quote_number        TEXT NOT NULL,
  client_name         TEXT NOT NULL,
  vehicle_model       TEXT,

  total_hours         NUMERIC NOT NULL DEFAULT 0,
  total_days          NUMERIC,

  start_date          DATE,
  end_date            DATE,

  status              TEXT NOT NULL DEFAULT 'WAITING',
    -- 'WAITING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'
  priority            INTEGER NOT NULL DEFAULT 5,

  requires_materials  BOOLEAN NOT NULL DEFAULT false,
  materials_ready     BOOLEAN NOT NULL DEFAULT false,
  requires_design     BOOLEAN NOT NULL DEFAULT false,
  design_ready        BOOLEAN NOT NULL DEFAULT false,

  actual_start_date   DATE,
  actual_end_date     DATE,
  actual_hours        NUMERIC,

  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_projects_status     ON production_projects(status);
CREATE INDEX IF NOT EXISTS idx_prod_projects_created    ON production_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prod_projects_quote_id   ON production_projects(quote_id);

ALTER TABLE production_projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'production_projects' AND policyname = 'production_projects_open'
  ) THEN
    CREATE POLICY "production_projects_open" ON production_projects FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 2. production_tasks
--    Used by: ProductionService.getProjectTasks()
--    Dashboards: AdminDashboard, EncargadoDashboard,
--               EncargadoTallerDashboard
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_tasks (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id          TEXT NOT NULL,
  task_name           TEXT NOT NULL,
  product_name        TEXT,
  estimated_hours     NUMERIC NOT NULL DEFAULT 0,
  actual_hours        NUMERIC DEFAULT 0,
  assigned_to         TEXT,
  assigned_date       DATE,
  status              TEXT NOT NULL DEFAULT 'PENDING',
    -- 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'
  requires_material   TEXT,
  material_ready      BOOLEAN NOT NULL DEFAULT false,
  requires_design     BOOLEAN NOT NULL DEFAULT false,
  design_ready        BOOLEAN NOT NULL DEFAULT false,
  blocked_reason      TEXT,
  order_index         INTEGER NOT NULL DEFAULT 0,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Catalog data (from QuoteAutomation)
  materials           TEXT,      -- JSON array of {name, quantity, unit}
  consumables         TEXT,      -- JSON array of {name, quantity, unit}
  materials_list      TEXT,      -- Legacy alias
  consumables_list    TEXT,      -- Legacy alias
  instructions_design TEXT,
  tipo_diseno         TEXT,
  requiere_diseno     BOOLEAN DEFAULT false,
  catalog_sku         TEXT,

  -- Block grouping
  task_block_id       TEXT,
  block_order         INTEGER,
  is_block_first      BOOLEAN DEFAULT false,
  materials_collected BOOLEAN DEFAULT false,

  -- Timing
  started_at          TIMESTAMPTZ,
  accumulated_hours   NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_prod_tasks_project   ON production_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_prod_tasks_status    ON production_tasks(status);
CREATE INDEX IF NOT EXISTS idx_prod_tasks_assigned  ON production_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_prod_tasks_block     ON production_tasks(project_id, task_block_id);

ALTER TABLE production_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'production_tasks' AND policyname = 'production_tasks_open'
  ) THEN
    CREATE POLICY "production_tasks_open" ON production_tasks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 3. production_employees
--    Used by: ConfigService.getEmployees()
--    Dashboards: AdminDashboard, EncargadoTallerDashboard
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_employees (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre                   TEXT NOT NULL,
  rol                      TEXT,
  especialidad_principal   TEXT,
  especialidad_secundaria  TEXT,
  tarifa_hora_eur          NUMERIC NOT NULL DEFAULT 0,
  horas_semanales          INTEGER DEFAULT 40,
  email                    TEXT UNIQUE,
  password_hash            TEXT,
  telefono                 TEXT,
  activo                   BOOLEAN NOT NULL DEFAULT true,
  role                     TEXT NOT NULL DEFAULT 'operario',
    -- 'admin' | 'encargado' | 'compras' | 'encargado_taller' | 'operario'
  permissions              JSONB NOT NULL DEFAULT '{}',
  last_login               TIMESTAMPTZ,
  active_session           BOOLEAN DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_employees_role   ON production_employees(role);
CREATE INDEX IF NOT EXISTS idx_prod_employees_activo ON production_employees(activo);

ALTER TABLE production_employees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'production_employees' AND policyname = 'production_employees_open'
  ) THEN
    CREATE POLICY "production_employees_open" ON production_employees FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 4. stock_items
--    Used by: StockService, PurchaseService.markAsReceived(),
--             exportStockToExcel(), TaskBoard, QRScanner
--    Dashboards: AdminDashboard, EncargadoDashboard,
--               ComprasDashboard (indirectly via Excel)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_items (
  referencia        TEXT PRIMARY KEY,
  familia           TEXT,
  categoria         TEXT,
  articulo          TEXT,
  descripcion       TEXT,
  cantidad          NUMERIC NOT NULL DEFAULT 0,
  stock_minimo      NUMERIC,
  unidad            TEXT NOT NULL DEFAULT 'ud',
  coste_iva_incluido NUMERIC DEFAULT 0,
  ubicacion         TEXT,
  proveedor         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_familia    ON stock_items(familia);
CREATE INDEX IF NOT EXISTS idx_stock_items_categoria  ON stock_items(categoria);
CREATE INDEX IF NOT EXISTS idx_stock_items_low_stock
  ON stock_items(cantidad) WHERE stock_minimo > 0 AND cantidad < stock_minimo;

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_items' AND policyname = 'stock_items_open'
  ) THEN
    CREATE POLICY "stock_items_open" ON stock_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 5. config_settings
--    Used by: ConfigService.getConfigByCategory(),
--             ProductionService.getSuggestions()
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'general',
  unit          TEXT,
  description   TEXT,
  data_type     TEXT NOT NULL DEFAULT 'text',
    -- 'text' | 'number' | 'boolean'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_settings_category ON config_settings(category);

ALTER TABLE config_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'config_settings' AND policyname = 'config_settings_open'
  ) THEN
    CREATE POLICY "config_settings_open" ON config_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed essential config settings
INSERT INTO config_settings (key, value, category, unit, description, data_type)
VALUES
  ('calendario.margen_seguridad_compras', '2', 'calendario', 'días', 'Margen de seguridad para compras de materiales', 'number'),
  ('calendario.margen_seguridad_diseño',  '2', 'calendario', 'días', 'Margen de seguridad para diseño', 'number'),
  ('taller.capacidad_empleados',          '4', 'taller',     'personas', 'Número de empleados simultáneos en taller', 'number'),
  ('taller.horas_dia',                    '8', 'taller',     'horas', 'Horas de trabajo por día en taller', 'number')
ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 6. business_lines (tarifas)
--    Used by: ConfigService.getTarifas()
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_lines (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  linea_negocio           TEXT NOT NULL,
  tarifa_hora_eur         NUMERIC NOT NULL DEFAULT 0,
  margen_materiales_pct   NUMERIC NOT NULL DEFAULT 0,
  urgencia                TEXT,
  dias_trabajo_semana     INTEGER DEFAULT 5,
  horas_dia               INTEGER DEFAULT 8,
  activa                  BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE business_lines ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_lines' AND policyname = 'business_lines_open'
  ) THEN
    CREATE POLICY "business_lines_open" ON business_lines FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default business line
INSERT INTO business_lines (id, linea_negocio, tarifa_hora_eur, margen_materiales_pct, activa)
VALUES ('default-camper', 'Camperización', 35, 15, true)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 7. roles
--    Used by: ConfigService.getRoles()
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  rol                 TEXT PRIMARY KEY,
  nivel               TEXT NOT NULL DEFAULT '1',
  anos_experiencia    TEXT,
  puede_realizar      TEXT,
  tarifa_min_eur      NUMERIC,
  tarifa_max_eur      NUMERIC,
  descripcion         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'roles' AND policyname = 'roles_open'
  ) THEN
    CREATE POLICY "roles_open" ON roles FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default roles
INSERT INTO roles (rol, nivel, descripcion)
VALUES
  ('admin',            '1', 'Administrador — acceso total'),
  ('encargado',        '2', 'Encargado — visión general'),
  ('compras',          '3', 'Compras — gestión de pedidos y stock'),
  ('encargado_taller', '4', 'Encargado de Taller — producción'),
  ('operario',         '5', 'Operario — tareas propias')
ON CONFLICT (rol) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 8. alert_settings
--    Used by: ConfigService.getAlerts()
--    Referenced by: migrations 006, 007 (which ALTER TABLE
--    on it without creating it first)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_settings (
  tipo_alerta    TEXT PRIMARY KEY,
  nombre         TEXT,
  descripcion    TEXT,
  icono          TEXT DEFAULT '🔔',
  activa         BOOLEAN NOT NULL DEFAULT true,
  dias_umbral    INTEGER DEFAULT 30,
  roles_destino  TEXT[] DEFAULT ARRAY['admin','encargado','compras'],
  prioridad      TEXT DEFAULT 'media',
  destinatario   TEXT DEFAULT 'admin',
  condicion      TEXT,
  modulo         TEXT DEFAULT 'crm',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'alert_settings' AND policyname = 'alert_settings_open'
  ) THEN
    CREATE POLICY "alert_settings_open" ON alert_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 9. company_info
--    Used by: ConfigService.getCompanyInfo()
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_info (
  campo      TEXT PRIMARY KEY,
  valor      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_info' AND policyname = 'company_info_open'
  ) THEN
    CREATE POLICY "company_info_open" ON company_info FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 10. Ensure RLS policies exist on tables from earlier migrations
--     (purchase_items from 012, quotes from 011, etc.)
--     Some may already have policies — safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- purchase_items (012 already adds RLS, but just in case)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_items') THEN
    ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'purchase_items' AND policyname = 'purchase_items_all'
    ) THEN
      CREATE POLICY "purchase_items_all" ON purchase_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 11. GRANT access to anon & authenticated roles
--     Without these, Supabase client SDK cannot query the tables
--     even if RLS policies are permissive.
-- ─────────────────────────────────────────────────────────────
GRANT ALL ON production_projects    TO anon, authenticated;
GRANT ALL ON production_tasks       TO anon, authenticated;
GRANT ALL ON production_employees   TO anon, authenticated;
GRANT ALL ON stock_items            TO anon, authenticated;
GRANT ALL ON config_settings        TO anon, authenticated;
GRANT ALL ON business_lines         TO anon, authenticated;
GRANT ALL ON roles                  TO anon, authenticated;
GRANT ALL ON alert_settings         TO anon, authenticated;
GRANT ALL ON company_info           TO anon, authenticated;

-- Also ensure the pre-existing tables have grants
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes') THEN
    EXECUTE 'GRANT ALL ON quotes TO anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_items') THEN
    EXECUTE 'GRANT ALL ON purchase_items TO anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_leads') THEN
    EXECUTE 'GRANT ALL ON crm_leads TO anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_events') THEN
    EXECUTE 'GRANT ALL ON calendar_events TO anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_work_orders') THEN
    EXECUTE 'GRANT ALL ON furniture_work_orders TO anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'furniture_designs') THEN
    EXECUTE 'GRANT ALL ON furniture_designs TO anon, authenticated';
  END IF;
END $$;


SELECT '✅ Migration 030: All missing tables created with RLS policies and GRANT access' AS status;
