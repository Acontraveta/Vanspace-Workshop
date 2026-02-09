import { useEffect } from 'react'
import { exportAllToExcel } from '@/lib/excelSync'

// Hook que se ejecuta cada 5 minutos para sincronizar cambios a Excel
export function useAutoExport() {
  useEffect(() => {
    // Exportar al cargar
    exportAllToExcel()

    // Exportar cada 5 minutos
    const interval = setInterval(() => {
      exportAllToExcel()
    }, 5 * 60 * 1000) // 5 minutos

    return () => clearInterval(interval)
  }, [])
}
