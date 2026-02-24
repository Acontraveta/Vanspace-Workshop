-- =====================================================
-- 018: Storage bucket policies for lead-documents
-- and design-files buckets.
--
-- Run in: Supabase → SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS)
--
-- ⚠️  ALSO ensure the buckets exist in Storage settings:
--   lead-documents  → Public: false
--   design-files    → Public: false
-- =====================================================

-- ── Create buckets if they don't exist ─────────────────────
-- (This INSERT is safe — ON CONFLICT does nothing)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('lead-documents', 'lead-documents', false),
  ('design-files', 'design-files', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage policies for lead-documents ────────────────────

-- Allow anyone (authenticated via anon key) to upload files
DROP POLICY IF EXISTS "lead_docs_insert" ON storage.objects;
CREATE POLICY "lead_docs_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'lead-documents');

-- Allow anyone to read files
DROP POLICY IF EXISTS "lead_docs_select" ON storage.objects;
CREATE POLICY "lead_docs_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'lead-documents');

-- Allow anyone to update files (e.g. upsert)
DROP POLICY IF EXISTS "lead_docs_update" ON storage.objects;
CREATE POLICY "lead_docs_update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'lead-documents');

-- Allow anyone to delete files
DROP POLICY IF EXISTS "lead_docs_delete" ON storage.objects;
CREATE POLICY "lead_docs_delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'lead-documents');

-- ── Storage policies for design-files ──────────────────────

DROP POLICY IF EXISTS "design_files_insert" ON storage.objects;
CREATE POLICY "design_files_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'design-files');

DROP POLICY IF EXISTS "design_files_select" ON storage.objects;
CREATE POLICY "design_files_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'design-files');

DROP POLICY IF EXISTS "design_files_update" ON storage.objects;
CREATE POLICY "design_files_update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'design-files');

DROP POLICY IF EXISTS "design_files_delete" ON storage.objects;
CREATE POLICY "design_files_delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'design-files');

SELECT 'Storage policies created ✅' AS status;
