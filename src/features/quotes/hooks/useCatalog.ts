import { useState, useEffect } from 'react'
import { CatalogProduct } from '../types/quote.types'
import { CatalogService } from '../services/catalogService'
import toast from 'react-hot-toast'

export function useCatalog() {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogLoaded, setCatalogLoaded] = useState(false)

  useEffect(() => {
    loadCatalog()
  }, [])

  const loadCatalog = async () => {
    setLoading(true)
    
    try {
      // Mostrar caché inmediatamente para UX rápida
      const cachedProducts = CatalogService.getProducts()
      if (cachedProducts.length > 0) {
        setProducts(cachedProducts)
        setCatalogLoaded(true)
      }
      
      // Siempre descargar fresco desde Supabase (sin cache de 1 hora)
      console.log('🔄 Descargando catálogo fresco desde Supabase...')
      const freshProducts = await CatalogService.loadFromSupabase()
      setProducts(freshProducts)
      setCatalogLoaded(freshProducts.length > 0)
      
      if (freshProducts.length > 0 && freshProducts.length !== cachedProducts.length) {
        toast.success(`Catálogo actualizado: ${freshProducts.length} productos`)
      }
      
    } catch (error: any) {
      console.error('❌ Error cargando catálogo:', error)
      toast.error('Error cargando catálogo. Usando caché local.')
      
      // Usar caché solo si la descarga falla
      const cachedProducts = CatalogService.loadFromLocalStorage()
      setProducts(cachedProducts)
      setCatalogLoaded(cachedProducts.length > 0)
      
    } finally {
      setLoading(false)
    }
  }

  const refreshCatalog = async () => {
    setLoading(true)
    try {
      const freshProducts = await CatalogService.loadFromSupabase()
      setProducts(freshProducts)
      setCatalogLoaded(freshProducts.length > 0)
      toast.success('Catálogo actualizado')
    } catch (error: any) {
      toast.error('Error actualizando catálogo')
    } finally {
      setLoading(false)
    }
  }

  return {
    products,
    loading,
    catalogLoaded,
    refreshCatalog,
  }
}
