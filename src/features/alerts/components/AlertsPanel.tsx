import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import type { UnifiedAlert, AlertModule } from "../types/alerts.types"
import { PRIORITY_COLORS, PRIORITY_DOT, PRIORITY_ORDER, MODULE_META, MODULE_COLORS } from "../types/alerts.types"

interface AlertsPanelProps {
  all: UnifiedAlert[]
  loading: boolean
  onClose: () => void
  onMarkVista: (id: string) => Promise<void>
  onResolve: (id: string) => Promise<void>
  onDismissCRM: (id: string) => Promise<void>
  onDismissLive: (id: string) => void
  onRunEngine: () => Promise<{ created: number; removed: number }>
  engineRunning: boolean
}

type ModuleFilter = AlertModule | "todas"

const MODULES: { id: ModuleFilter; label: string; icon: string }[] = [
  { id: "todas",        label: "Todas",         icon: "" },
  { id: "crm",         label: "CRM",            icon: "" },
  { id: "produccion",  label: "Produccion",     icon: "" },
  { id: "pedidos",     label: "Pedidos",        icon: "" },
  { id: "stock",       label: "Stock",          icon: "" },
  { id: "presupuestos",label: "Presupuestos",   icon: "" },
]

function timeAgo(dateStr: string) {
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es }) }
  catch { return "" }
}

export function AlertsPanel({
  all,
  loading,
  onClose,
  onMarkVista,
  onResolve,
  onDismissCRM,
  onDismissLive,
  onRunEngine,
  engineRunning,
}: AlertsPanelProps) {
  const navigate = useNavigate()
  const [module, setModule] = useState<ModuleFilter>("todas")
  const [showResolved, setShowResolved] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  const visible = all
    .filter(a => module === "todas" || a.modulo === module)
    .filter(a => showResolved ? a.estado === "resuelta" : a.estado !== "resuelta")
    .slice()
    .sort((a, b) => PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad])

  const countByModule = (m: ModuleFilter) =>
    all.filter(a => (m === "todas" || a.modulo === m) && a.estado === "pendiente").length

  const handleAction = async (fn: () => void | Promise<void>, id: string) => {
    setActioning(id)
    try { await fn() } finally { setActioning(null) }
  }

  const goTo = (a: UnifiedAlert) => {
    onClose()
    if (a._kind === "crm") {
      navigate("/crm", { state: { openLeadId: a.lead_id } })
    } else {
      navigate(a.navPath)
    }
  }

  const pendingTotal = all.filter(a => a.estado === "pendiente").length

  return (
    <>
      <div className="fixed inset-0 top-14 lg:top-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed top-14 lg:top-0 right-0 h-[calc(100%-3.5rem)] lg:h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900"> Alertas</h2>
            <p className="text-xs text-gray-400 mt-0.5">{pendingTotal} pendiente{pendingTotal !== 1 ? "s" : ""} en total</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResolved(v => !v)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${showResolved ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            >
              {showResolved ? "Ver pendientes" : "Ver resueltas"}
            </button>
            <button
              onClick={async () => { await onRunEngine() }}
              disabled={engineRunning}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              {engineRunning ? " Analizando..." : " Actualizar"}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none"></button>
          </div>
        </div>

        {/* Module filter bar */}
        <div className="flex overflow-x-auto shrink-0 border-b border-gray-100 px-1 pt-1 gap-1 scrollbar-none">
          {MODULES.map(m => {
            const count = countByModule(m.id)
            const active = module === m.id
            return (
              <button
                key={m.id}
                onClick={() => setModule(m.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-medium rounded-t-lg transition border-b-2 ${
                  active ? "border-blue-600 text-blue-700 bg-blue-50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {m.icon && <span>{m.icon}</span>}
                {m.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-600"}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-b-transparent rounded-full" />
              <span className="text-sm">Cargando alertas...</span>
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <span className="text-4xl mb-3">{showResolved ? "" : ""}</span>
              <p className="text-sm font-medium">
                {showResolved ? "No hay alertas resueltas" : `Sin alertas${module !== "todas" ? " en este módulo" : ""}`}
              </p>
            </div>
          )}
          {!loading && visible.map(alert => {
            const isCRM = alert._kind === "crm"
            const isLive = alert._kind === "live"
            const navLabel = isCRM ? "Ver en CRM" : `Ver en ${MODULE_META[alert.modulo]?.label ?? "módulo"}`
            const fecha = isCRM ? (alert as any).fecha_generada : undefined
            const resolved = alert.estado === "resuelta"

            return (
              <div
                key={alert.id}
                className={`px-5 py-4 border-b border-gray-50 transition ${resolved ? "opacity-60 bg-gray-50/50" : "hover:bg-gray-50/50"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[alert.prioridad]}`} />
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-start gap-2 justify-between flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{alert.titulo}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${MODULE_COLORS[alert.modulo]}`}>
                        {MODULE_META[alert.modulo]?.icon} {MODULE_META[alert.modulo]?.label}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.descripcion}</p>

                    {/* CRM lead phone/email */}
                    {isCRM && (alert as any).lead?.telefono && (
                      <p className="text-xs text-blue-600 mt-1">
                         {(alert as any).lead.telefono}
                        {(alert as any).lead.email && ` · ${(alert as any).lead.email}`}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLORS[alert.prioridad]}`}>
                        {alert.prioridad}
                      </span>
                      {fecha && <span className="text-xs text-gray-400">{timeAgo(fecha)}</span>}
                      {isLive && <span className="text-xs text-gray-400 italic">En tiempo real</span>}
                    </div>

                    {/* Action buttons */}
                    {!resolved && (
                      <div className="flex gap-1.5 mt-2.5 flex-wrap">
                        <button
                          onClick={() => goTo(alert)}
                          className="text-xs px-2.5 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
                        >
                          {navLabel} 
                        </button>

                        {/* CRM-only: mark as viewed */}
                        {isCRM && alert.estado === "pendiente" && (
                          <button
                            onClick={() => handleAction(() => onMarkVista(alert.id), alert.id)}
                            disabled={actioning === alert.id}
                            className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                          >
                            Marcar vista
                          </button>
                        )}

                        {/* CRM-only: resolve */}
                        {isCRM && (
                          <button
                            onClick={() => handleAction(() => onResolve(alert.id), alert.id)}
                            disabled={actioning === alert.id}
                            className="text-xs px-2.5 py-1 rounded border border-green-200 text-green-700 hover:bg-green-50 transition disabled:opacity-50"
                          >
                             Resolver
                          </button>
                        )}

                        {/* Dismiss (CRM = soft delete in DB; live = localStorage 24h) */}
                        <button
                          onClick={() => handleAction(
                            isCRM
                              ? () => onDismissCRM(alert.id)
                              : () => { onDismissLive(alert.id) },
                            alert.id
                          )}
                          disabled={actioning === alert.id}
                          className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-400 hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          Ignorar {isLive && "(24h)"}
                        </button>
                      </div>
                    )}

                    {resolved && isCRM && (alert as any).resuelta_por && (
                      <p className="text-xs text-green-600 mt-1.5"> Resuelta por {(alert as any).resuelta_por}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
          <button
            onClick={() => { onClose(); navigate("/config", { state: { tab: "alerts" } }) }}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
             Configurar alertas
          </button>
          {all.filter(a => a.estado === "resuelta").length > 0 && !showResolved && (
            <button onClick={() => setShowResolved(true)} className="text-xs text-gray-400 hover:text-gray-600">
              Ver resueltas ({all.filter(a => a.estado === "resuelta").length})
            </button>
          )}
        </div>
      </div>
    </>
  )
}
