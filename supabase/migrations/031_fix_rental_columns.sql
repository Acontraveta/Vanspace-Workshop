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

-- Fix purchase_items RLS policy: migration 012 created it WITHOUT "WITH CHECK(true)"
-- causing INSERT/UPDATE (e.g. from quote automation) to be silently rejected.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_items') THEN
    DROP POLICY IF EXISTS "purchase_items_all" ON purchase_items;
    CREATE POLICY "purchase_items_all" ON purchase_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

SELECT '✅ Migration 031: rental columns + purchase_items RLS fix applied' AS status;
