import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { importCatalogFromFile, importStockFromFile, syncConfigFromExcel } from '@/lib/excelSync'
import toast from 'react-hot-toast'

export default function InitialSetup() {
  const [loading, setLoading] = useState(false)
  const [catalogFile, setCatalogFile] = useState<File | null>(null)
  const [stockFile, setStockFile] = useState<File | null>(null)
  const [configFile, setConfigFile] = useState<File | null>(null)
  const [results, setResults] = useState<string[]>([])
  const catalogInputRef = useRef<HTMLInputElement>(null)
  const stockInputRef = useRef<HTMLInputElement>(null)
  const configInputRef = useRef<HTMLInputElement>(null)

  const addResult = (msg: string) => setResults(prev => [...prev, msg])

  const handleImportAll = async () => {
    if (!catalogFile && !stockFile && !configFile) {
      toast.error('Selecciona al menos un archivo Excel')
      return
    }
    
    setLoading(true)
    setResults([])
    
    try {
      if (catalogFile) {
        addResult('📦 Importando catálogo...')
        const count = await importCatalogFromFile(catalogFile)
        addResult(`✅ Catálogo: ${count} productos importados`)
        toast.success(`✅ Catálogo: ${count} productos`)
      }
      
      if (stockFile) {
        addResult('📊 Importando stock...')
        const count = await importStockFromFile(stockFile)
        addResult(`✅ Stock: ${count} items importados`)
        toast.success(`✅ Stock: ${count} items`)
      }
      
      // Configuración desde Storage (se sube primero el archivo si existe)
      if (configFile) {
        addResult('⚙️ Importando configuración...')
        const { uploadExcel } = await import('@/lib/supabase')
        await uploadExcel(
          new File([configFile], 'configuracion_general.xlsx', { type: configFile.type }),
          'configuracion_general.xlsx'
        )
        const configResult = await syncConfigFromExcel()
        addResult(`✅ Configuración: ${configResult.tarifas} tarifas, ${configResult.employees} empleados, ${configResult.roles} roles`)
        toast.success(`✅ Configuración: ${configResult.tarifas} tarifas, ${configResult.employees} empleados`)
      }
      
      addResult('🎉 ¡Importación completa!')
      toast.success('🎉 Importación completa')
    } catch (error: any) {
      const msg = error?.message || String(error)
      addResult(`❌ Error: ${msg}`)
      toast.error('Error: ' + msg)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="text-2xl">🚀 Configuración Inicial</CardTitle>
          <p className="text-gray-600 mt-2">
            Selecciona los Excels y se importarán directamente a la base de datos + se subirán a Storage como respaldo.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Seleccionar archivos */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-4">
            <p className="font-medium text-blue-800">📂 Selecciona los archivos Excel</p>
            
            <div className="flex items-center gap-3">
              <input
                ref={catalogInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setCatalogFile(e.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => catalogInputRef.current?.click()}
                className="min-w-[180px]"
              >
                📦 Catálogo (.xlsx)
              </Button>
              <span className="text-sm text-gray-600">
                {catalogFile 
                  ? `✅ ${catalogFile.name} (${(catalogFile.size / 1024).toFixed(1)} KB)` 
                  : 'No seleccionado'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                ref={stockInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setStockFile(e.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => stockInputRef.current?.click()}
                className="min-w-[180px]"
              >
                📊 Stock (.xlsx)
              </Button>
              <span className="text-sm text-gray-600">
                {stockFile 
                  ? `✅ ${stockFile.name} (${(stockFile.size / 1024).toFixed(1)} KB)` 
                  : 'No seleccionado'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                ref={configInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setConfigFile(e.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => configInputRef.current?.click()}
                className="min-w-[180px]"
              >
                ⚙️ Configuración (.xlsx)
              </Button>
              <span className="text-sm text-gray-600">
                {configFile 
                  ? `✅ ${configFile.name} (${(configFile.size / 1024).toFixed(1)} KB)` 
                  : 'No seleccionado'}
              </span>
            </div>
          </div>

          {/* Botón importar */}
          <Button
            onClick={handleImportAll}
            disabled={loading || (!catalogFile && !stockFile && !configFile)}
            className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-50"
          >
            {loading ? '⏳ Importando...' : '🚀 Importar a BD + Storage'}
          </Button>

          <div className="text-xs text-gray-500">
            Los archivos se leen directamente desde tu dispositivo, se importan a la base de datos
            y se suben a Supabase Storage como respaldo (para auditorías o descargas futuras).
          </div>

          {/* Resultados */}
          {results.length > 0 && (
            <div className="bg-gray-100 rounded p-4 space-y-1">
              <p className="font-medium text-sm mb-2">📋 Progreso:</p>
              {results.map((r, i) => (
                <p key={i} className="text-sm">{r}</p>
              ))}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
