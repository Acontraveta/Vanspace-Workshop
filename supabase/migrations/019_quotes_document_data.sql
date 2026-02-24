-- ═══════════════════════════════════════════════════════════════
-- 019 · Add document_data column to quotes
--
-- Stores edited document state (customLines, footerNotes,
-- company info, payment installments) so manual edits from
-- QuotePreview persist and carry over to invoice generation.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS document_data JSONB;

COMMENT ON COLUMN quotes.document_data IS
  'Edited document data (customLines, footerNotes, showBreakdown, paymentInstallments, company). Persisted from QuotePreview edits.';
