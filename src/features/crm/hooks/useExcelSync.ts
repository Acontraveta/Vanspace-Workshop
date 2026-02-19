import { useState } from 'react'
import { useCRMStore } from '../store/crmStore'
import { importCRMFromExcel, importCRMFromFile } from '../services/excelImporter'
import { exportCRMToExcel, downloadCRMAsExcel } from '../services/excelExporter'

export function useExcelSync() {
  const { setSyncStatus, loadLeads, leads } = useCRMStore()
  const [log, setLog] = useState<string[]>([])

  const addLog = (msg: string) => setLog(prev => [...prev, msg])

  // ── Import from Storage (pulls the stored crm.xlsx) ──────────────

  const importFromStorage = async () => {
    setSyncStatus({ isImporting: true, error: undefined })
    setLog([])
    try {
      const count = await importCRMFromExcel(addLog)
      setSyncStatus({
        isImporting: false,
        lastSync: new Date().toISOString(),
        rowsImported: count,
      })
      await loadLeads()
    } catch (err: any) {
      setSyncStatus({ isImporting: false, error: err?.message })
      addLog(`❌ Error: ${err?.message}`)
    }
  }

  // ── Import from user-selected file ──────────────────────────────

  const importFromFile = async (file: File) => {
    setSyncStatus({ isImporting: true, error: undefined })
    setLog([])
    try {
      const count = await importCRMFromFile(file, addLog)
      setSyncStatus({
        isImporting: false,
        lastSync: new Date().toISOString(),
        rowsImported: count,
      })
      await loadLeads()
    } catch (err: any) {
      setSyncStatus({ isImporting: false, error: err?.message })
      addLog(`❌ Error: ${err?.message}`)
    }
  }

  // ── Export to Storage ────────────────────────────────────────────

  const exportToStorage = async () => {
    setSyncStatus({ isExporting: true, error: undefined })
    setLog([])
    try {
      await exportCRMToExcel(addLog)
      setSyncStatus({ isExporting: false })
    } catch (err: any) {
      setSyncStatus({ isExporting: false, error: err?.message })
      addLog(`❌ Error: ${err?.message}`)
    }
  }

  // ── Download to browser ──────────────────────────────────────────

  const downloadExcelFile = async () => {
    await downloadCRMAsExcel(leads)
  }

  return {
    importFromStorage,
    importFromFile,
    exportToStorage,
    downloadExcelFile,
    log,
  }
}
