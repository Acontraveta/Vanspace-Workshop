/**
 * QuotesTabbedList.tsx
 *
 * Vista principal del listado de documentos con 4 pestañas:
 *  - Presupuestos  (DRAFT, SENT, REJECTED, EXPIRED)
 *  - Facturas      (APPROVED → tratadas como facturas)
 *  - Proformas     (QuickDocs de tipo PROFORMA)
 *  - Simplificadas (QuickDocs de tipo FACTURA_SIMPLIFICADA)
 *
 * Incluye barra de búsqueda (texto + rango de fechas) en todas las pestañas.
 */

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '@/shared/utils/portalRoot'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { QuoteService } from '../services/quoteService'
import { QuoteAutomation } from '../services/quoteAutomation'
import { QuickDocService, QuickDocRecord } from '../services/quickDocService'
import { PurchaseService } from '@/features/purchases/services/purchaseService'
import { PurchaseItem } from '@/features/purchases/types/purchase.types'
import { Quote } from '../types/quote.types'
import { supabase } from '@/lib/supabase'
import QuotePreview from './QuotePreview'
import QuickDocViewerModal from './QuickDocViewerModal'
import FiscalReportModal from './FiscalReportModal'
import toast from 'react-hot-toast'
import { fmtHours } from '@/shared/utils/formatters'

// ─── Types ───────────────────────────────────────────────────

type MainTab = 'presupuestos' | 'albaranes' | 'facturas' | 'proformas' | 'simplificadas'
type QuoteSubFilter = 'all' | 'active' | 'cancelled' | 'expired'

interface QuotesTabbedListProps {
  onEditQuote: (quoteId: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusLabel(status: Quote['status']) {
  switch (status) {
    case 'DRAFT':    return { icon: '📝', text: 'Borrador',  variant: 'default'      as const }
    case 'SENT':     return { icon: '📤', text: 'Enviado',   variant: 'default'      as const }
    case 'APPROVED': return { icon: '✅', text: 'Facturado', variant: 'success'      as const }
    case 'ALBARAN':  return { icon: '📦', text: 'Albarán',   variant: 'default'      as const }
    case 'REJECTED': return { icon: '❌', text: 'Cancelado', variant: 'destructive'  as const }
    case 'EXPIRED':  return { icon: '⏰', text: 'Caducado',  variant: 'secondary'    as const }
    default:         return { icon: '❓', text: status,      variant: 'outline'      as const }
  }
}

// ─── Component ───────────────────────────────────────────────

export default function QuotesTabbedList({ onEditQuote }: QuotesTabbedListProps) {
  // ── Main tab ──────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('presupuestos')
  const [quoteSubFilter, setQuoteSubFilter] = useState<QuoteSubFilter>('all')

  // ── Viewer state ─────────────────────────────────────────
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null)
  const [viewingDoc, setViewingDoc]     = useState<QuickDocRecord | null>(null)
  const [showFiscalReport, setShowFiscalReport] = useState(false)

  // ── Search ────────────────────────────────────────────────
  const [searchText, setSearchText]     = useState('')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')

  // ── Data ──────────────────────────────────────────────────
  const [refreshKey, setRefreshKey]     = useState(0)
  const [proformas, setProformas]       = useState<QuickDocRecord[]>(() => QuickDocService.getByType('PROFORMA'))
  const [simplificadas, setSimplificadas] = useState<QuickDocRecord[]>(() => QuickDocService.getByType('FACTURA_SIMPLIFICADA'))
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])

  const allQuotes     = useMemo(() => QuoteService.getAllQuotes(), [refreshKey])

  // Fetch quick docs from Supabase on mount and on refresh
  useEffect(() => {
    // Sincronizar presupuestos desde Supabase
    QuoteService.syncFromSupabase().then(() => refresh())
    QuickDocService.fetchAll().then(all => {
      setProformas(all.filter(d => d.type === 'PROFORMA'))
      setSimplificadas(all.filter(d => d.type === 'FACTURA_SIMPLIFICADA'))
    })
    PurchaseService.getAllPurchases().then(setPurchaseItems)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refetch quick docs on refreshKey changes (after initial mount)
  useEffect(() => {
    if (refreshKey === 0) return
    QuickDocService.fetchAll().then(all => {
      setProformas(all.filter(d => d.type === 'PROFORMA'))
      setSimplificadas(all.filter(d => d.type === 'FACTURA_SIMPLIFICADA'))
    })
  }, [refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  // ── Filtered quotes ───────────────────────────────────────

  const matchesSearch = (q: Quote): boolean => {
    if (searchText) {
      const lower = searchText.toLowerCase()
      if (
        !q.clientName.toLowerCase().includes(lower) &&
        !q.quoteNumber.toLowerCase().includes(lower) &&
        !(q.vehicleModel ?? '').toLowerCase().includes(lower) &&
        !(q.clientEmail ?? '').toLowerCase().includes(lower)
      ) return false
    }
    if (dateFrom && new Date(q.createdAt) < new Date(dateFrom)) return false
    if (dateTo   && new Date(q.createdAt) > new Date(dateTo + 'T23:59:59')) return false
    return true
  }

  const matchesSearchDoc = (d: QuickDocRecord): boolean => {
    if (searchText) {
      const lower = searchText.toLowerCase()
      if (
        !d.clientName.toLowerCase().includes(lower) &&
        !d.docNumber.toLowerCase().includes(lower)
      ) return false
    }
    if (dateFrom && d.docDate < dateFrom) return false
    if (dateTo   && d.docDate > dateTo)   return false
    return true
  }

  const presupuestosAll = allQuotes.filter(q =>
    q.status === 'DRAFT' || q.status === 'SENT' || q.status === 'REJECTED' || q.status === 'EXPIRED'
  )

  const presupuestosList = presupuestosAll.filter(q => {
    if (quoteSubFilter === 'active')    return q.status === 'DRAFT'    || q.status === 'SENT'
    if (quoteSubFilter === 'cancelled') return q.status === 'REJECTED'
    if (quoteSubFilter === 'expired')   return q.status === 'EXPIRED'
    return true
  }).filter(matchesSearch)

  const albaranesList = allQuotes.filter(q => q.status === 'ALBARAN').filter(matchesSearch)
  const facturasList  = allQuotes.filter(q => q.status === 'APPROVED').filter(matchesSearch)
  const proformasList = proformas.filter(matchesSearchDoc)
  const simpList      = simplificadas.filter(matchesSearchDoc)

  // ── Actions ───────────────────────────────────────────────

  const handleApprove = async (quote: Quote) => {
    try {
      const approvedQuote = QuoteService.approveQuote(quote.id)
      const result = await QuoteAutomation.executeAutomation(approvedQuote)
      refresh()
      if (!result.success) {
        toast.error('Error en automatización: ' + (result.errors?.[0] ?? 'error desconocido'), { duration: 8000 })
      } else {
        toast.success(`✅ Aprobado · 📦 ${result.details.totalPurchaseItems} compras · ⚙️ ${result.details.totalTasks} tareas`)
        if (result.errors.length > 0) {
          toast.error('⚠️ ' + result.errors.join('\n'), { duration: 8000 })
        }
      }
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const [confirmAction, setConfirmAction] = useState<{ message: string; action: () => void | Promise<void> } | null>(null)

  const handleCancel = (quoteId: string) => {
    setConfirmAction({
      message: '¿Cancelar este presupuesto?',
      action: () => {
        try {
          QuoteService.cancelQuote(quoteId)
          refresh()
        } catch (error: any) {
          toast.error(error.message)
        }
      }
    })
  }

  const handleDelete = (quoteId: string) => {
    setConfirmAction({
      message: '¿Eliminar este presupuesto? Esta acción no se puede deshacer.',
      action: async () => {
        try {
          await QuoteService.deleteQuote(quoteId)
          refresh()
        } catch (error: any) {
          toast.error(error.message)
        }
      }
    })
  }

  const handleDeleteFactura = (quoteId: string) => {
    setConfirmAction({
      message: '⚠️ ¿Eliminar esta factura del sistema? Esta acción es irreversible y eliminará la factura, su proyecto asociado y todas las compras/tareas generadas.',
      action: async () => {
        try {
          await QuoteService.deleteQuote(quoteId)
          refresh()
        } catch (error: any) {
          toast.error(error.message)
        }
      }
    })
  }

  const handleDuplicate = (quote: Quote) => {
    try {
      const dup = QuoteService.duplicateQuote(quote)
      toast.success(`📋 Duplicado como ${dup.quoteNumber}`)
      refresh()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEmitInvoice = (quote: Quote) => {
    setConfirmAction({
      message: `¿Emitir factura para el albarán ${quote.quoteNumber}?`,
      action: () => {
        try {
          QuoteService.emitInvoice(quote.id)
          refresh()
        } catch (error: any) {
          toast.error(error.message)
        }
      },
    })
  }

  const handleDeleteDoc = (id: string) => {
    setConfirmAction({
      message: '¿Eliminar este documento?',
      action: () => {
        QuickDocService.delete(id)
        refresh()
      }
    })
  }

  const getProjectProgress = async (quote: Quote) => {
    try {
      const { data: projects } = await supabase
        .from('production_projects')
        .select('id')
        .eq('quote_number', quote.quoteNumber)
        .limit(1)

      if (!projects?.length) return { completed: 0, total: 0, percentage: 0 }

      const { data: tasks } = await supabase
        .from('production_tasks')
        .select('status')
        .eq('project_id', projects[0].id)

      if (!tasks?.length) return { completed: 0, total: 0, percentage: 0 }

      const completed = tasks.filter((t: any) => t.status === 'COMPLETED').length
      return { completed, total: tasks.length, percentage: Math.round((completed / tasks.length) * 100) }
    } catch {
      return { completed: 0, total: 0, percentage: 0 }
    }
  }

  // ── Sub-components ────────────────────────────────────────

  const QuoteCard = ({ quote, isFactura = false, isAlbaran = false }: { quote: Quote; isFactura?: boolean; isAlbaran?: boolean }) => {
    const st = statusLabel(quote.status)
    const daysLeft = QuoteService.getDaysUntilExpiration(quote)
    const isExpiringSoon = daysLeft <= 3 && quote.status !== 'APPROVED' && quote.status !== 'ALBARAN' && quote.status !== 'REJECTED' && quote.status !== 'EXPIRED'
    const [progress, setProgress] = useState<{ completed: number; total: number; percentage: number } | null>(null)

    useEffect(() => {
      if (quote.status === 'APPROVED' || quote.status === 'ALBARAN') {
        getProjectProgress(quote).then(setProgress)
      }
    }, [quote.id, quote.status])

    return (
      <Card
        className={`hover:shadow-lg transition cursor-pointer ${
          isExpiringSoon         ? 'border-orange-300 bg-orange-50'  :
          isAlbaran              ? 'border-amber-200 bg-amber-50/40' :
          isFactura              ? 'border-green-200 bg-green-50/40' : ''
        }`}
        onClick={() => {
          if (isFactura || isAlbaran) {
            setViewingQuote(quote)
          } else {
            onEditQuote(quote.id)
          }
        }}
      >
        <CardContent className="p-5">

          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-bold text-sm font-mono text-gray-600">{quote.quoteNumber}</span>
                {!isFactura && !isAlbaran && (
                  <Badge variant={st.variant}>{st.icon} {st.text}</Badge>
                )}
                {isAlbaran && (
                  <Badge className="bg-amber-500 text-white">📦 Albarán</Badge>
                )}
                {isFactura && (
                  <Badge variant="success">🧾 Factura</Badge>
                )}
                {isExpiringSoon && (
                  <Badge variant="warning">⚠️ Caduca en {daysLeft}d</Badge>
                )}
              </div>
              <p className="font-semibold text-gray-900 truncate">{quote.clientName}</p>
              {quote.vehicleModel && (
                <p className="text-xs text-gray-500">{quote.vehicleModel}</p>
              )}
            </div>
            <div className="text-right ml-2 shrink-0">
              <p className="text-xl font-bold text-blue-600">{fmt(quote.total)} €</p>
              <p className="text-xs text-gray-400">{quote.items.length} líneas · {fmtHours(quote.totalHours)}h</p>
            </div>
          </div>

          {/* Progress for approved */}
          {(isFactura || isAlbaran) && progress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Progreso del proyecto</span>
                <span className="font-semibold text-green-700">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              {progress.total > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">{progress.completed}/{progress.total} tareas</p>
              )}
            </div>
          )}

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
            <div>
              <span className="text-gray-400">Creado: </span>
              {new Date(quote.createdAt).toLocaleDateString('es-ES')}
            </div>
            <div>
              <span className="text-gray-400">Tarifa: </span>
              {quote.tarifa?.name || '—'}
            </div>
            {quote.approvedAt && (
              <div className="col-span-2">
                <span className="text-gray-400">Aprobado: </span>
                <span className="text-green-700 font-medium">{new Date(quote.approvedAt).toLocaleDateString('es-ES')}</span>
              </div>
            )}
            {quote.cancelledAt && (
              <div className="col-span-2">
                <span className="text-gray-400">Cancelado: </span>
                <span className="text-red-600">{new Date(quote.cancelledAt).toLocaleDateString('es-ES')}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
            {(quote.status === 'DRAFT' || quote.status === 'SENT') && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white flex-1" onClick={() => handleApprove(quote)}>
                  ✅ Aprobar
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEditQuote(quote.id)}>✏️</Button>
                <Button size="sm" variant="outline" onClick={() => handleCancel(quote.id)}>❌</Button>
              </>
            )}
            {quote.status === 'EXPIRED' && (
              <>
                <Button size="sm" variant="outline" className="flex-1" disabled>⏰ Caducado</Button>
                <Button size="sm" variant="outline" onClick={() => onEditQuote(quote.id)}>✏️</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(quote.id)}>🗑️</Button>
              </>
            )}
            {quote.status === 'REJECTED' && (
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDelete(quote.id)}>🗑️ Eliminar</Button>
            )}
            {isAlbaran && (
              <>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white flex-1" onClick={() => handleEmitInvoice(quote)}>
                  🧾 Emitir factura
                </Button>
                <Button size="sm" variant="outline" onClick={() => setViewingQuote(quote)}>
                  👁️
                </Button>
              </>
            )}
            {isFactura && (
              <>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewingQuote(quote)}>
                  👁️ Ver documento
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDuplicate(quote)}>
                  📋
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDeleteFactura(quote.id)}>
                  🗑️
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const QuickDocCard = ({ doc }: { doc: QuickDocRecord }) => {
    const isProforma = doc.type === 'PROFORMA'
    const accent = isProforma ? '#7c3aed' : '#1d4ed8'

    return (
      <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => setViewingDoc(doc)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold" style={{ color: accent }}>{doc.docNumber}</span>
                <Badge
                  className="text-white text-xs"
                  style={{ background: accent }}
                >
                  {isProforma ? '📋 Proforma' : '🧾 Simplificada'}
                </Badge>
              </div>
              <p className="font-semibold text-gray-900 truncate">{doc.clientName}</p>
              {doc.clientNif && <p className="text-xs text-gray-400">NIF: {doc.clientNif}</p>}
            </div>
            <div className="text-right ml-2 shrink-0">
              <p className="text-xl font-bold" style={{ color: accent }}>{fmt(doc.total)} €</p>
              <p className="text-xs text-gray-400">IVA {doc.vatPct}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
            <div>
              <span className="text-gray-400">Fecha: </span>
              {new Date(doc.docDate).toLocaleDateString('es-ES')}
            </div>
            <div>
              <span className="text-gray-400">Líneas: </span>
              {doc.lines.length}
            </div>
            <div>
              <span className="text-gray-400">Base: </span>
              {fmt(doc.subtotal)} €
            </div>
            <div>
              <span className="text-gray-400">IVA: </span>
              {fmt(doc.vatAmount)} €
            </div>
          </div>

          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setViewingDoc(doc)}
            >
              👁️ Ver
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDeleteDoc(doc.id)}
            >
              🗑️
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Tab counts ────────────────────────────────────────────

  const tabCounts: Record<MainTab, number> = {
    presupuestos:  presupuestosAll.length,
    albaranes:     allQuotes.filter(q => q.status === 'ALBARAN').length,
    facturas:      allQuotes.filter(q => q.status === 'APPROVED').length,
    proformas:     proformas.length,
    simplificadas: simplificadas.length,
  }

  // ── Layout ────────────────────────────────────────────────

  const TABS: { key: MainTab; label: string; icon: string }[] = [
    { key: 'presupuestos',  label: 'Presupuestos',  icon: '📋' },
    { key: 'albaranes',     label: 'Albaranes',      icon: '📦' },
    { key: 'facturas',      label: 'Facturas',       icon: '🧾' },
    { key: 'proformas',     label: 'Proformas',      icon: '📄' },
    { key: 'simplificadas', label: 'Simplificadas',  icon: '🗒️' },
  ]

  const currentEmpty =
    mainTab === 'presupuestos'  ? presupuestosList.length === 0  :
    mainTab === 'albaranes'     ? albaranesList.length === 0      :
    mainTab === 'facturas'      ? facturasList.length === 0       :
    mainTab === 'proformas'     ? proformasList.length === 0      :
    simpList.length === 0

  const emptyLabels: Record<MainTab, string> = {
    presupuestos:  'No hay presupuestos',
    albaranes:     'No hay albaranes pendientes',
    facturas:      'No hay facturas emitidas',
    proformas:     'No hay proformas guardadas',
    simplificadas: 'No hay facturas simplificadas',
  }

  return (
    <div className="space-y-5">

      {/* ── Main tabs ─────────────────────────────────────── */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setMainTab(tab.key); setQuoteSubFilter('all') }}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-medium text-sm transition ${
                  mainTab === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  mainTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Search bar ────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Text search */}
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <Input
                className="pl-8 text-sm"
                placeholder={
                  mainTab === 'presupuestos' || mainTab === 'facturas'
                    ? 'Buscar por cliente, nº presupuesto, vehículo…'
                    : 'Buscar por cliente o nº documento…'
                }
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-xs text-gray-500 whitespace-nowrap">Desde</label>
              <Input
                type="date"
                className="text-sm w-36"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
              <label className="text-xs text-gray-500 whitespace-nowrap">Hasta</label>
              <Input
                type="date"
                className="text-sm w-36"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
              {(searchText || dateFrom || dateTo) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setSearchText(''); setDateFrom(''); setDateTo('') }}
                  className="text-gray-400 hover:text-gray-700"
                >
                  ✕ Limpiar
                </Button>
              )}

              {/* Fiscal report button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFiscalReport(true)}
                className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                🏛️ Informes
              </Button>
            </div>
          </div>

          {/* Sub-filter for presupuestos */}
          {mainTab === 'presupuestos' && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {([
                { key: 'all',       label: 'Todos',     count: presupuestosAll.length },
                { key: 'active',    label: 'Activos',   count: presupuestosAll.filter(q => q.status === 'DRAFT' || q.status === 'SENT').length },
                { key: 'cancelled', label: 'Cancelados',count: presupuestosAll.filter(q => q.status === 'REJECTED').length },
                { key: 'expired',   label: 'Caducados', count: presupuestosAll.filter(q => q.status === 'EXPIRED').length },
              ] as const).map(sf => (
                <button
                  key={sf.key}
                  onClick={() => setQuoteSubFilter(sf.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                    quoteSubFilter === sf.key
                      ? 'bg-blue-100 border-blue-400 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {sf.label} <span className="ml-1 opacity-70">({sf.count})</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Content ───────────────────────────────────────── */}

      {currentEmpty ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <p className="text-4xl mb-3">
              {mainTab === 'presupuestos'  ? '📋' :
               mainTab === 'albaranes'     ? '📦' :
               mainTab === 'facturas'      ? '🧾' :
               mainTab === 'proformas'     ? '📄' : '🗒️'}
            </p>
            <p className="text-lg font-medium">{emptyLabels[mainTab]}</p>
            {(searchText || dateFrom || dateTo) && (
              <p className="text-sm mt-1 text-gray-400">Prueba a modificar los filtros de búsqueda</p>
            )}
            {mainTab === 'proformas' || mainTab === 'simplificadas' ? (
              <p className="text-sm mt-2 text-gray-400">
                Genera un documento desde "✏️ Nuevo Documento" y guárdalo para verlo aquí
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

          {mainTab === 'presupuestos' && presupuestosList.map(q => (
            <QuoteCard key={q.id} quote={q} />
          ))}

          {mainTab === 'albaranes' && albaranesList.map(q => (
            <QuoteCard key={q.id} quote={q} isAlbaran />
          ))}

          {mainTab === 'facturas' && facturasList.map(q => (
            <QuoteCard key={q.id} quote={q} isFactura />
          ))}

          {mainTab === 'proformas' && proformasList.map(d => (
            <QuickDocCard key={d.id} doc={d} />
          ))}

          {mainTab === 'simplificadas' && simpList.map(d => (
            <QuickDocCard key={d.id} doc={d} />
          ))}

        </div>
      )}

      {/* ── Quote viewer (facturas / presupuestos) ───────── */}
      {viewingQuote && createPortal(
        <QuotePreview
          quote={viewingQuote}
          type={viewingQuote.status === 'APPROVED' ? 'FACTURA' : viewingQuote.status === 'ALBARAN' ? 'ALBARAN' : 'PRESUPUESTO'}
          onClose={() => setViewingQuote(null)}
        />,
        getPortalRoot()
      )}

      {/* ── QuickDoc viewer (proformas / simplificadas) ──── */}
      {viewingDoc && createPortal(
        <QuickDocViewerModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />,
        getPortalRoot()
      )}

      {/* ── Confirmation dialog via portal ──── */}
      {confirmAction && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-xl p-5 shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-gray-800 mb-4">{confirmAction.message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmAction(null)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={async () => { await confirmAction.action(); setConfirmAction(null) }} className="text-sm px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600">Confirmar</button>
            </div>
          </div>
        </div>,
        getPortalRoot()
      )}

      {/* ── Fiscal report modal ──── */}
      {showFiscalReport && (
        <FiscalReportModal
          facturas={allQuotes.filter(q => q.status === 'APPROVED')}
          simplificadas={simplificadas}
          proformas={proformas}
          purchaseItems={purchaseItems}
          onClose={() => setShowFiscalReport(false)}
        />
      )}
    </div>
  )
}
