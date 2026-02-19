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
  return {
    stock,
    loading,
    stockLoaded,
  }
}