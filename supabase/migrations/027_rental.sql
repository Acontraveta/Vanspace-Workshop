-- ============================================================
-- 027 Rental — Alquiler de furgonetas camper
-- ============================================================

-- Vehículos de la flota de alquiler
CREATE TABLE IF NOT EXISTS rental_vehicles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,          -- Nombre comercial
  matricula   TEXT NOT NULL UNIQUE,
  modelo      TEXT NOT NULL,
  anio        INT,
  plazas      INT NOT NULL DEFAULT 4,
  camas       INT NOT NULL DEFAULT 2,
  precio_dia_eur   NUMERIC(8,2) NOT NULL DEFAULT 0,
  precio_semana_eur NUMERIC(8,2),
  fianza_eur       NUMERIC(8,2) NOT NULL DEFAULT 500,
  km_incluidos     INT,                  -- Km incluidos por día (ej. 200)
  precio_km_extra  NUMERIC(6,2),         -- €/km extra sobre el límite
  equipamiento     JSONB DEFAULT '[]'::jsonb,
  fotos            JSONB DEFAULT '[]'::jsonb,
  notas            TEXT,
  status           TEXT NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','reserved','rented','returning','maintenance','inactive')),
  km_actual             INT,
  proxima_itv           DATE,
  proximo_mantenimiento DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reservas de alquiler
CREATE TABLE IF NOT EXISTS rental_bookings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id     UUID NOT NULL REFERENCES rental_vehicles(id) ON DELETE CASCADE,
  -- Cliente
  cliente_nombre    TEXT NOT NULL,
  cliente_telefono  TEXT,
  cliente_email     TEXT,
  cliente_dni       TEXT,
  cliente_carnet    TEXT,
  -- Fechas
  fecha_inicio         DATE NOT NULL,
  fecha_fin            DATE NOT NULL,
  fecha_entrega_real   DATE,
  fecha_devolucion_real DATE,
  -- Económico
  precio_total   NUMERIC(10,2) NOT NULL DEFAULT 0,
  fianza         NUMERIC(8,2) NOT NULL DEFAULT 0,
  fianza_devuelta BOOLEAN DEFAULT false,
  descuento_pct  NUMERIC(5,2) DEFAULT 0,
  pagado         BOOLEAN DEFAULT false,
  metodo_pago    TEXT,
  -- Estado
  status TEXT NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending','confirmed','active','completed','cancelled')),
  km_salida   INT,
  km_llegada  INT,
  incidencias TEXT,
  notas       TEXT,
  extras      JSONB DEFAULT '[]'::jsonb,
  coste_km_extra NUMERIC(8,2) DEFAULT 0,  -- Coste calculado por km extra
  -- CRM link
  lead_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rental_bookings_vehicle  ON rental_bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_dates    ON rental_bookings(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_status   ON rental_bookings(status);
CREATE INDEX IF NOT EXISTS idx_rental_vehicles_status   ON rental_vehicles(status);

-- RLS
ALTER TABLE rental_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rental_vehicles_all" ON rental_vehicles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "rental_bookings_all" ON rental_bookings
  FOR ALL USING (true) WITH CHECK (true);
