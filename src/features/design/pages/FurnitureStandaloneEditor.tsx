import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FurnitureDesignService } from '../services/furnitureDesignService'
import { FurnitureDesign, InteractivePiece, ModuleDimensions, PlacedPiece } from '../types/furniture.types'
import { FurniturePieceEditor } from '../components/FurniturePieceEditor'
import toast from 'react-hot-toast'

/**
 * Standalone furniture designer — use without a work order.
 * Routes: /design/furniture/new  (create)
 *         /design/furniture/edit/:designId  (edit existing)
 */
export default function FurnitureStandaloneEditor() {
  const { designId } = useParams<{ designId: string }>()
  const navigate = useNavigate()
  const [design, setDesign] = useState<FurnitureDesign | null>(null)
  const [loading, setLoading] = useState(!!designId)

  useEffect(() => {
    if (!designId) return
    ;(async () => {
      try {
        const d = await FurnitureDesignService.getById(designId)
        if (!d) { toast.error('Diseño no encontrado'); navigate('/design/furniture'); return }
        setDesign(d)
      } catch (err: any) {
        toast.error('Error cargando diseño: ' + err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [designId])

  const handleSave = async (
    module: ModuleDimensions,
    pieces: InteractivePiece[],
    cuts: PlacedPiece[]
  ) => {
    const saved = await FurnitureDesignService.saveStandalone({
      name: module.name,
      module,
      pieces,
      optimizedCuts: cuts,
      existingId: design?.id,
    })
    setDesign(saved)
    // If we were in "new" mode, update the URL to "edit" so re-saving works
    if (!designId) {
      navigate(`/design/furniture/edit/${saved.id}`, { replace: true })
    }
  }

  const handleClose = () => {
    navigate('/design/furniture')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
      <FurniturePieceEditor
        itemName={design?.quote_item_name ?? 'Nuevo mueble'}
        savedDesign={design}
        projectInfo="Diseño libre (biblioteca)"
        onSave={handleSave}
        onClose={handleClose}
      />
    </div>
  )
}
