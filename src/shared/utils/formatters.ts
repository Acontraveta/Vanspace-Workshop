/**
 * Utilidades de formato numérico con locale español (es-ES).
 *
 * Todos los números visibles al usuario deben usar estas funciones
 * para garantizar que los decimales usen coma y los miles usen punto.
 */

/** Formatea un número como moneda EUR → "1.234,56" (sin símbolo €) */
export function fmtEur(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Formatea un número como moneda EUR compacto para KPIs → "12,3k" */
export function fmtEurK(n: number | null | undefined): string {
  const v = (n ?? 0) / 1000
  return v.toLocaleString('es-ES', {
    minimumFractionDigits: v % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }) + 'k'
}

/** Formatea horas → "3,5" */
export function fmtHours(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/** Formatea un número decimal genérico con N dígitos → "1.234,56" */
export function fmtNum(n: number | null | undefined, decimals = 2): string {
  return (n ?? 0).toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
