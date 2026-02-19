-- =====================================================
-- ALL-MODULE ALERT CONFIGS
-- Adds production / purchases / stock alert rules
-- to the existing alert_settings table.
-- Run in: Supabase → SQL Editor
-- =====================================================

-- Add module column (defaults to 'crm' for existing rows)
ALTER TABLE alert_settings
  ADD COLUMN IF NOT EXISTS modulo VARCHAR(50) DEFAULT 'crm';

-- Backfill existing CRM rows
UPDATE alert_settings SET modulo = 'crm' WHERE modulo IS NULL;

-- ── PRODUCCIÓN ────────────────────────────────────────

INSERT INTO alert_settings
  (tipo_alerta, nombre, descripcion, icono, activa, dias_umbral, roles_destino, prioridad, modulo)
VALUES
  (
    'proyecto_atrasado',
    'Proyecto con retraso',
    'Un proyecto activo ha superado su fecha de entrega prevista',
    '🚨', true, 0,
    ARRAY['admin','encargado','encargado_taller'],
    'alta', 'produccion'
  ),
  (
    'proyecto_sin_inicio',
    'Proyecto sin iniciar',
    'Un proyecto planificado lleva más de X días sin iniciarse',
    '⏳', true, 3,
    ARRAY['admin','encargado','encargado_taller'],
    'media', 'produccion'
  ),
  (
    'tarea_bloqueada',
    'Tareas bloqueadas',
    'Existen tareas de producción con status BLOQUEADA',
    '🔒', true, 0,
    ARRAY['admin','encargado','encargado_taller'],
    'alta', 'produccion'
  ),
  (
    'materiales_pendientes',
    'Materiales pendientes en proyecto',
    'Un proyecto activo requiere materiales que aún no han llegado',
    '📦', true, 0,
    ARRAY['admin','encargado','compras'],
    'alta', 'produccion'
  ),
  (
    'diseno_pendiente',
    'Diseño pendiente en proyecto',
    'Un proyecto activo requiere diseño todavía no aprobado',
    '🎨', true, 0,
    ARRAY['admin','encargado'],
    'media', 'produccion'
  )
ON CONFLICT (tipo_alerta) DO UPDATE
  SET nombre       = EXCLUDED.nombre,
      descripcion  = EXCLUDED.descripcion,
      icono        = EXCLUDED.icono,
      modulo       = EXCLUDED.modulo;

-- ── PEDIDOS ───────────────────────────────────────────

INSERT INTO alert_settings
  (tipo_alerta, nombre, descripcion, icono, activa, dias_umbral, roles_destino, prioridad, modulo)
VALUES
  (
    'pedido_urgente_sin_pedir',
    'Material urgente sin pedir',
    'Hay materiales con prioridad alta (≥6) en estado PENDIENTE sin tramitar',
    '🔴', true, 0,
    ARRAY['admin','encargado','compras'],
    'alta', 'pedidos'
  ),
  (
    'pedidos_pendientes_resumen',
    'Pedidos pendientes de tramitar',
    'Hay materiales en estado PENDIENTE que aún no se han pedido al proveedor',
    '📋', true, 0,
    ARRAY['admin','encargado','compras'],
    'media', 'pedidos'
  ),
  (
    'pedido_sin_recibir',
    'Pedido sin recibir',
    'Un pedido tramitado lleva más de X días sin confirmación de recepción',
    '📬', true, 10,
    ARRAY['admin','compras'],
    'media', 'pedidos'
  )
ON CONFLICT (tipo_alerta) DO UPDATE
  SET nombre       = EXCLUDED.nombre,
      descripcion  = EXCLUDED.descripcion,
      icono        = EXCLUDED.icono,
      modulo       = EXCLUDED.modulo;

-- ── STOCK ─────────────────────────────────────────────

INSERT INTO alert_settings
  (tipo_alerta, nombre, descripcion, icono, activa, dias_umbral, roles_destino, prioridad, modulo)
VALUES
  (
    'stock_bajo',
    'Stock por debajo del mínimo',
    'Hay artículos del inventario con cantidad inferior a su mínimo configurado',
    '📉', true, 0,
    ARRAY['admin','compras'],
    'media', 'stock'
  ),
  (
    'stock_cero',
    'Artículos agotados',
    'Hay artículos con stock en cero',
    '❌', true, 0,
    ARRAY['admin','compras'],
    'alta', 'stock'
  )
ON CONFLICT (tipo_alerta) DO UPDATE
  SET nombre       = EXCLUDED.nombre,
      descripcion  = EXCLUDED.descripcion,
      icono        = EXCLUDED.icono,
      modulo       = EXCLUDED.modulo;

-- ── PRESUPUESTOS ──────────────────────────────────────

INSERT INTO alert_settings
  (tipo_alerta, nombre, descripcion, icono, activa, dias_umbral, roles_destino, prioridad, modulo)
VALUES
  (
    'presupuesto_alto_perdido',
    'Presupuesto de alto valor sin cerrar',
    'Un presupuesto en estado no aprobado con importe alto lleva más de X días sin respuesta',
    '💰', true, 14,
    ARRAY['admin','encargado','compras'],
    'alta', 'presupuestos'
  )
ON CONFLICT (tipo_alerta) DO UPDATE
  SET nombre       = EXCLUDED.nombre,
      descripcion  = EXCLUDED.descripcion,
      icono        = EXCLUDED.icono,
      modulo       = EXCLUDED.modulo;

SELECT 'All-module alert configs ready ✅' AS status;
