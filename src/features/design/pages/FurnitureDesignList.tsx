import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FurnitureWorkOrderService } from '../services/furnitureDesignService'
import { FurnitureWorkOrder } from '../types/furniture.types'
import toast from 'react-hot-toast'

const STATUS = {
  pending:     { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  in_progress: { label: 'En proceso',  color: 'bg-blue-100 text-blue-700',     icon: '✏️' },
  completed:   { label: 'Completado',  color: 'bg-green-100 text-green-700',   icon: '✅' },
} as const

export default function FurnitureDesignList() {
  const [orders, setOrders] = useState<FurnitureWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const data = await FurnitureWorkOrderService.getAll()
      setOrders(data)
    } catch (err: any) {
      toast.error('Error cargando órdenes de diseño')
    } finally {
      setLoading(false)
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
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          🪑 Diseño de Muebles
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Órdenes de diseño generadas automáticamente al aprobar presupuestos con muebles
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="text-5xl mb-3">🪑</div>
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
      )}
    </div>
  )
}
