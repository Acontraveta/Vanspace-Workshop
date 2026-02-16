import { useEffect } from 'react'
import { exportAllToExcel } from '@/lib/excelSync'

// Hook que se ejecuta cada 5 minutos para sincronizar cambios a Excel
// Solo exporta si las tablas tienen datos (no sobreescribe Excels originales con vacío)
export function useAutoExport() {
  useEffect(() => {
    // Esperar 2 minutos antes del primer export para dar tiempo a la importación inicial
    const initialTimeout = setTimeout(() => {
      console.log('📤 Auto-export: primera ejecución (2min después de carga)')
      exportAllToExcel()
    }, 2 * 60 * 1000)

    // Exportar cada 5 minutos
    const interval = setInterval(() => {
      exportAllToExcel()
    }, 5 * 60 * 1000) // 5 minutos

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [])
}
