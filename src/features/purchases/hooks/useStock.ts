import { useState, useEffect } from 'react'
import { StockItem } from '../types/purchase.types'
import { StockService } from '../services/stockService'
import toast from 'react-hot-toast'

export function useStock() {
  const [stock, setStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [stockLoaded, setStockLoaded] = useState(false)

  useEffect(() => {
    const loadedStock = StockService.getStock()
    setStock(loadedStock)
    setStockLoaded(loadedStock.length > 0)
  }, [])

  const importStock = async (file: File) => {
    setLoading(true)
    try {
      const importedStock = await StockService.importFromFile(file)
      setStock(importedStock)
      setStockLoaded(true)
      toast.success(`Stock importado: ${importedStock.length} items`)
      return importedStock
    } catch (error: any) {
      toast.error('Error importando stock: ' + error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    stock,
    loading,
    stockLoaded,
    importStock,
  }
}