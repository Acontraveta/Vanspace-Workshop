-- ═══════════════════════════════════════════════════════════════
-- 034 · Add billing columns to crm_leads
--
-- The app stores billing/invoicing data on each lead so it can
-- be copied to Quote.billingData when creating a presupuesto.
-- These columns were defined in crm.types.ts but never created
-- in any migration.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS billing_nif          TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS billing_fiscal_name  TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS billing_address      TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS billing_postal_code  TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS billing_city         TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS billing_province     TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS billing_country      TEXT;

SELECT '✅ Migration 034: crm_leads billing columns added' AS status;
