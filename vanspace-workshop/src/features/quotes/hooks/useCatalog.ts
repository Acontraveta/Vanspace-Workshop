import { useState, useEffect } from 'react'
import { CatalogProduct } from '../types/quote.types'
import { CatalogService } from '../services/catalogService'
import { useLocalStorage } from '@/shared/hooks/useLocalStorage'
import toast from 'react-hot-toast'

export function useCatalog() {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [catalogLoaded, setCatalogLoaded] = useLocalStorage('catalog_loaded', false)

  // Cargar productos guardados en localStorage
  useEffect(() => {
    const savedProducts = CatalogService.getProducts()
    if (savedProducts.length > 0) {
      setProducts(savedProducts)
    }
  }, [])

  const importCatalog = async (file: File) => {
    setLoading(true)
    try {
      const importedProducts = await CatalogService.importFromFile(file)
      setProducts(importedProducts)
      setCatalogLoaded(true)
      
      // Guardar en localStorage para persistencia
      localStorage.setItem('catalog_products', JSON.stringify(importedProducts))
      
      toast.success(`Catálogo importado: ${importedProducts.length} productos`)
      return importedProducts
    } catch (error: any) {
      toast.error('Error importando catálogo: ' + error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const getProductBySKU = (sku: string) => {
    return CatalogService.getProductBySKU(sku)
  }

  const getCategories = () => {
    return CatalogService.getCategories()
  }

  return {
    products,
    loading,
    catalogLoaded,
    importCatalog,
    getProductBySKU,
    getCategories,
  }
}
