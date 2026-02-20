import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FurnitureWorkOrderService, FurnitureDesignService } from '../services/furnitureDesignService'
import { FurnitureWorkOrder, FurnitureDesign } from '../types/furniture.types'
import { MaterialCatalogManager } from '../components/MaterialCatalogManager'
import toast from 'react-hot-toast'

type ActiveTab = 'orders' | 'library' | 'materials'

const STATUS = {
  pending:     { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  in_progress: { label: 'En proceso',  color: 'bg-blue-100 text-blue-700',     icon: '✏️' },
  completed:   { label: 'Completado',  color: 'bg-green-100 text-green-700',   icon: '✅' },
} as const

export default function FurnitureDesignList() {
  const [tab, setTab] = useState<ActiveTab>('orders')
  const [orders, setOrders] = useState<FurnitureWorkOrder[]>([])
  const [designs, setDesigns] = useState<FurnitureDesign[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [wo, lib] = await Promise.all([
        FurnitureWorkOrderService.getAll(),
        FurnitureDesignService.getAllStandalone(),
      ])
      setOrders(wo)
      setDesigns(lib)
    } catch (err: any) {
      toast.error('Error cargando diseños')
    } finally {
      setLoading(false)
    }
  }

  const deleteDesign = async (id: string) => {
    if (!confirm('¿Eliminar este diseño de la biblioteca?')) return
    try {
      await FurnitureDesignService.delete(id)
      setDesigns(prev => prev.filter(d => d.id !== id))
      toast.success('Diseño eliminado')
    } catch {
      toast.error('Error eliminando diseño')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            🪑 Diseño de Muebles
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Órdenes de trabajo y biblioteca de diseños reutilizables
          </p>
        </div>
        <button
          onClick={() => navigate('/furniture-design/new')}
          className="px-5 py-2.5 bg-amber-600 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all"
        >
          + Nuevo diseño libre
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: 'orders' as ActiveTab, label: '📋 Órdenes', count: orders.length },
          { key: 'library' as ActiveTab, label: '📚 Biblioteca', count: designs.length },
          { key: 'materials' as ActiveTab, label: '🪵 Materiales' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
              tab === t.key
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label} {'count' in t ? `(${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── ORDERS TAB ──────────────────────────────────────────────────── */}
      {tab === 'orders' && (
        orders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-5xl mb-3">📋</div>
            <h3 className="text-lg font-bold text-slate-700">Sin órdenes de diseño</h3>
            <p className="text-sm text-slate-400 mt-1">
              Aparecerán aquí cuando se aprueben presupuestos con muebles
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(wo => {
              const items = (wo.items ?? []) as { quoteItemName: string; designStatus: string }[]
              const s = STATUS[wo.status as keyof typeof STATUS] ?? STATUS.pending
              const designedCount = items.filter(i => i.designStatus !== 'pending').length
              return (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/furniture-design/${wo.id}`)}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-amber-300 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-2xl flex-shrink-0">
                    🪑
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800">{wo.quote_number}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.color}`}>
                        {s.icon} {s.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate">{wo.client_name}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-slate-400">
                        {items.length} mueble{items.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex-1 max-w-[200px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            designedCount === items.length ? 'bg-green-500' : 'bg-amber-500'
                          }`}
                          style={{ width: items.length ? `${(designedCount / items.length) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{designedCount}/{items.length}</span>
                    </div>
                  </div>
                  <span className="text-slate-300 text-lg flex-shrink-0">›</span>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── LIBRARY TAB ─────────────────────────────────────────────────── */}
      {tab === 'library' && (
        designs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-5xl mb-3">📚</div>
            <h3 className="text-lg font-bold text-slate-700">Biblioteca vacía</h3>
            <p className="text-sm text-slate-400 mt-1">
              Crea diseños libres para reutilizar en futuros proyectos
            </p>
            <button
              onClick={() => navigate('/furniture-design/new')}
              className="mt-4 px-5 py-2.5 bg-amber-600 text-white text-xs font-black uppercase rounded-xl hover:bg-amber-700 transition-all"
            >
              + Crear primer diseño
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map(d => {
              const piecesCount = Array.isArray(d.pieces) ? d.pieces.length : 0
              const m = d.module as { name?: string; type?: string; width?: number; height?: number; depth?: number }
              return (
                <div
                  key={d.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-amber-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl flex-shrink-0">
                        🪑
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{d.quote_item_name}</p>
                        {m.type && (
                          <p className="text-[10px] text-slate-400 uppercase">{m.type}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 space-y-0.5">
                    {m.width && m.height && m.depth && (
                      <p>📐 {m.width} × {m.height} × {m.depth} mm</p>
                    )}
                    <p>🧩 {piecesCount} pieza{piecesCount !== 1 ? 's' : ''}</p>
                    <p className="text-[10px] text-slate-300">
                      Actualizado {new Date(d.updated_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>

                  <div className="flex gap-2 mt-auto pt-2">
                    <button
                      onClick={() => navigate(`/furniture-design/edit/${d.id}`)}
                      className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-blue-700 transition-all"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => deleteDesign(d.id)}
                      className="py-2 px-3 bg-red-50 text-red-500 text-[10px] font-black uppercase rounded-lg hover:bg-red-100 transition-all"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── MATERIALS TAB ───────────────────────────────────────────────────────── */}
      {tab === 'materials' && <MaterialCatalogManager />}
    </div>
  )
}
