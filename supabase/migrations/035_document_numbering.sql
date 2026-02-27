-- =============================================
-- 035: Numeración configurable de documentos
-- =============================================
-- Permite continuar con la numeración de un software anterior.
-- Los campos 'next_number' se incrementan automáticamente al generar cada documento.

INSERT INTO config_settings (key, value, category, unit, description, data_type)
VALUES
  ('numeracion.presupuesto_prefijo',  'P',   'presupuestos', NULL,   'Prefijo del número de presupuesto (ej: P, QUO, PRES)',              'text'),
  ('numeracion.presupuesto_siguiente','1',    'presupuestos', NULL,   'Siguiente número secuencial de presupuesto',                        'number'),
  ('numeracion.albaran_prefijo',      'ALB',  'presupuestos', NULL,   'Prefijo del número de albarán (ej: ALB)',                           'text'),
  ('numeracion.albaran_siguiente',    '1',    'presupuestos', NULL,   'Siguiente número secuencial de albarán',                            'number'),
  ('numeracion.factura_prefijo',      'FAC',  'presupuestos', NULL,   'Prefijo del número de factura (ej: FAC, F)',                        'text'),
  ('numeracion.factura_siguiente',    '1',    'presupuestos', NULL,   'Siguiente número secuencial de factura',                            'number')
ON CONFLICT (key) DO NOTHING;

-- Añadir columnas para guardar los números de albarán y factura en quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS albaran_number TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS invoice_number TEXT;
