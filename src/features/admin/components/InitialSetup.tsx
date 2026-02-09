import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { syncCatalogFromExcel, syncStockFromExcel } from '@/lib/excelSync'
import toast from 'react-hot-toast'

export default function InitialSetup() {
  const [loading, setLoading] = useState(false)

  const handleImportCatalog = async () => {
    setLoading(true)
    try {
      const count = await syncCatalogFromExcel()
      toast.success(`✅ ${count} productos importados`)
    } catch (error: any) {
      toast.error('Error: ' + (error?.message || String(error)))
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleImportStock = async () => {
    setLoading(true)
    try {
      const count = await syncStockFromExcel()
      toast.success(`✅ ${count} items importados`)
    } catch (error: any) {
      toast.error('Error: ' + (error?.message || String(error)))
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleImportAll = async () => {
    setLoading(true)
    try {
      const catCount = await syncCatalogFromExcel()
      toast.success(`✅ Catálogo: ${catCount} productos`)
      
      const stockCount = await syncStockFromExcel()
      toast.success(`✅ Stock: ${stockCount} items`)
      
      toast.success('🎉 Importación completa')
    } catch (error: any) {
      toast.error('Error: ' + (error?.message || String(error)))
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
            Importar datos desde los Excels en Supabase Storage
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-800">
              📝 Los archivos Excel ya están en Supabase Storage. 
              Haz click en "Importar Todo" para cargar los datos en la base de datos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleImportCatalog}
              disabled={loading}
              variant="outline"
              className="h-20"
            >
              📦 Importar Catálogo
            </Button>

            <Button
              onClick={handleImportStock}
              disabled={loading}
              variant="outline"
              className="h-20"
            >
              📊 Importar Stock
            </Button>
          </div>

          <Button
            onClick={handleImportAll}
            disabled={loading}
            className="w-full h-16 text-lg bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            {loading ? '⏳ Importando...' : '🚀 Importar Todo'}
          </Button>

          <div className="mt-6 p-4 bg-gray-100 rounded text-xs">
            <p className="font-medium mb-2">Archivos en Storage:</p>
            <ul className="space-y-1 text-gray-600">
              <li>• catalogoproductos.xlsx</li>
              <li>• stock.xlsx</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
