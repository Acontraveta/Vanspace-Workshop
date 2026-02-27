-- ═══════════════════════════════════════════════════════════════
-- 031 · Fix rental tables — add missing columns
--
-- The rental tables may have been created before km_incluidos
-- and coste_km_extra were added to the migration file.
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════

-- rental_vehicles: km_incluidos, precio_km_extra
ALTER TABLE rental_vehicles
  ADD COLUMN IF NOT EXISTS km_incluidos     INT,
  ADD COLUMN IF NOT EXISTS precio_km_extra  NUMERIC(6,2);

-- rental_bookings: coste_km_extra
ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS coste_km_extra   NUMERIC(8,2) DEFAULT 0;

-- GRANT — 027 did not include grants, so Supabase SDK may fail even with RLS open
GRANT ALL ON rental_vehicles TO anon, authenticated;
GRANT ALL ON rental_bookings TO anon, authenticated;

SELECT '✅ Migration 031: rental columns km_incluidos, precio_km_extra, coste_km_extra added' AS status;
