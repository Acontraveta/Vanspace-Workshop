import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ConfigService } from '../services/configService'
import { Tarifa } from '../types/config.types'

export function useTarifas(onlyActive = true) {
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const all = await ConfigService.getTarifas()
      setTarifas(onlyActive ? all.filter(t => t.activa) : all)
    } catch (error) {
      console.error('Error cargando tarifas:', error)
    } finally {
      setLoading(false)
    }
  }, [onlyActive])

  useEffect(() => {
    load()

    // Suscripción realtime
    const channel = supabase
      .channel('tarifas-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_lines' },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { tarifas, loading, reload: load }
}
