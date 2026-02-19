-- =====================================================
-- LEAD DOCUMENTS TABLE
-- Stores metadata for files attached to CRM leads.
-- Actual files live in the Supabase Storage bucket: lead-documents
--
-- ⚠️  BEFORE RUNNING: create the storage bucket manually:
--   Supabase Dashboard → Storage → New bucket
--   Name: lead-documents   |  Public: false
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_documents (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id       UUID          NOT NULL,
  file_name     VARCHAR(255)  NOT NULL,
  file_path     TEXT          NOT NULL,          -- path inside the bucket
  file_type     VARCHAR(100),                    -- MIME type
  file_size     BIGINT,                          -- bytes
  doc_category  VARCHAR(80)   NOT NULL DEFAULT 'otro',
  -- 'presupuesto' | 'factura' | 'inspeccion' | 'homologacion'
  -- | 'contrato' | 'seguro' | 'ficha_tecnica' | 'foto' | 'otro'
  notes         TEXT,
  uploaded_by   VARCHAR(255),
  uploaded_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_documents_lead_id ON lead_documents (lead_id);

-- RLS: allow all authenticated (same open policy as design_files)
ALTER TABLE lead_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_documents_all" ON lead_documents;
CREATE POLICY "lead_documents_all" ON lead_documents
  FOR ALL USING (true);

SELECT 'lead_documents table ready ✅' AS status;
