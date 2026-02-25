-- ═══════════════════════════════════════════════════════════════
-- 024 · Add lead_id column to quick_docs
-- Allows linking simplified invoices / proformas to CRM leads
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE quick_docs ADD COLUMN IF NOT EXISTS lead_id TEXT;

CREATE INDEX IF NOT EXISTS idx_quick_docs_lead_id ON quick_docs(lead_id);
