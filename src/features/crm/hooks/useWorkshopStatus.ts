/**
 * useWorkshopStatus
 *
 * Returns the production status for a given client name.
 * Uses a module-level cache so all cards share the same data
 * with a 60-second TTL — avoids N requests for N cards.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── Module-level cache ────────────────────────────────────────
let projectCache: Map<string, string> | null = null
let cacheTimestamp = 0
let inflightPromise: Promise<Map<string, string>> | null = null
const CACHE_TTL_MS = 60_000

async function loadCache(): Promise<Map<string, string>> {
  if (projectCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return projectCache
  }

  // Share the in-flight promise so 1000 simultaneous calls → 1 request
  if (!inflightPromise) {
    inflightPromise = (async () => {
      const { data } = await supabase
        .from('production_projects')
        .select('client_name, status')
        .in('status', ['WAITING', 'SCHEDULED', 'IN_PROGRESS', 'ON_HOLD'])

      const map = new Map<string, string>()
      for (const row of data || []) {
        if (row.client_name) {
          map.set((row.client_name as string).toLowerCase(), row.status as string)
        }
      }

      projectCache = map
      cacheTimestamp = Date.now()
      inflightPromise = null
      return map
    })()
  }

  return inflightPromise
}

/** Invalidate the cache (call after production actions). */
export function invalidateWorkshopCache() {
  projectCache = null
  cacheTimestamp = 0
}

export type WorkshopStatus = 'WAITING' | 'SCHEDULED' | 'IN_PROGRESS' | 'ON_HOLD' | null

/**
 * @param clientName - Lead.cliente value
 * @returns The production status for this client, or null if not in workshop.
 */
export function useWorkshopStatus(clientName: string | undefined): WorkshopStatus {
  const [status, setStatus] = useState<WorkshopStatus>(null)

  useEffect(() => {
    if (!clientName) return

    loadCache().then(map => {
      const s = map.get(clientName.toLowerCase())
      setStatus((s as WorkshopStatus) ?? null)
    }).catch(console.warn)
  }, [clientName])

  return status
}
