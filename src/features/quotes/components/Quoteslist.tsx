import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { QuoteService } from '../services/quoteService'
import { QuoteAutomation } from '../services/quoteAutomation'
import { Quote } from '../types/quote.types'
import toast from 'react-hot-toast'

interface QuotesListProps {
  onEditQuote: (quoteId: string) => void
}

export default function QuotesList({ onEditQuote }: QuotesListProps) {
  const [quotes, setQuotes] = useState(QuoteService.getQuotesByCategory())
  const [selectedTab, setSelectedTab] = useState<'active' | 'approved' | 'cancelled' | 'expired'>('active')

  const refreshQuotes = () => {
    setQuotes(QuoteService.getQuotesByCategory())
  }

  useEffect(() => {
    refreshQuotes()
  }, [])

  const handleApprove = async (quote: Quote) => {
    try {
      const approvedQuote = QuoteService.approveQuote(quote.id)
      await QuoteAutomation.executeAutomation(approvedQuote)
      refreshQuotes()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleCancel = (quoteId: string) => {
    if (confirm('¿Cancelar este presupuesto?')) {
      try {
        QuoteService.cancelQuote(quoteId)
        refreshQuotes()
      } catch (error: any) {
        toast.error(error.message)
      }
    }
  }

  const handleDelete = (quoteId: string) => {
    if (confirm('¿Eliminar este presupuesto? Esta acción no se puede deshacer.')) {
      try {
        QuoteService.deleteQuote(quoteId)
        refreshQuotes()
      } catch (error: any) {
        toast.error(error.message)
      }
    }
  }

  // Función para obtener progreso del proyecto
  const getProjectProgress = (quote: Quote) => {
    // Obtener tareas del proyecto
    const allTasks = JSON.parse(localStorage.getItem('production_tasks') || '[]')
    const projectTasks = allTasks.filter((t: any) => {
      // Encontrar tareas que pertenecen a este presupuesto
      // (asumiendo que el projectId se guardó con el quoteId)
      return t.projectId && t.projectId.includes(quote.id.slice(-5))
    })

    if (projectTasks.length === 0) return { completed: 0, total: 0, percentage: 0 }

    const completed = projectTasks.filter((t: any) => t.status === 'COMPLETED').length
    const total = projectTasks.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return { completed, total, percentage }
  }

  const tabs = [
    { key: 'active' as const, label: 'Activos', count: quotes.active.length, color: 'blue' },
    { key: 'approved' as const, label: 'Aprobados', count: quotes.approved.length, color: 'green' },
    { key: 'cancelled' as const, label: 'Cancelados', count: quotes.cancelled.length, color: 'red' },
    { key: 'expired' as const, label: 'Caducados', count: quotes.expired.length, color: 'gray' },
  ]

  const currentQuotes = quotes[selectedTab]

  const QuoteCard = ({ quote }: { quote: Quote }) => {
    const daysLeft = QuoteService.getDaysUntilExpiration(quote)
    const isExpiringSoon = daysLeft <= 3 && quote.status !== 'APPROVED' && quote.status !== 'REJECTED' && quote.status !== 'EXPIRED'
    const progress = quote.status === 'APPROVED' ? getProjectProgress(quote) : null

    return (
      <Card className={`hover:shadow-lg transition ${
        isExpiringSoon ? 'border-orange-300 bg-orange-50' : 
        quote.status === 'APPROVED' ? 'border-green-300 bg-green-50' : ''
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-lg">{quote.quoteNumber}</h3>
                <Badge variant={
                  quote.status === 'APPROVED' ? 'success' :
                  quote.status === 'REJECTED' ? 'destructive' :
                  quote.status === 'EXPIRED' ? 'secondary' :
                  'default'
                }>
                  {quote.status === 'DRAFT' && '📝 Borrador'}
                  {quote.status === 'SENT' && '📤 Enviado'}
                  {quote.status === 'APPROVED' && '✅ Aprobado'}
                  {quote.status === 'REJECTED' && '❌ Cancelado'}
                  {quote.status === 'EXPIRED' && '⏰ Caducado'}
                </Badge>
                {isExpiringSoon && (
                  <Badge variant="warning">
                    ⚠️ Caduca en {daysLeft}d
                  </Badge>
                )}
              </div>
              <p className="text-xl font-semibold text-gray-900">{quote.clientName}</p>
              {quote.vehicleModel && (
                <p className="text-sm text-gray-600">{quote.vehicleModel}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{quote.total.toFixed(2)}€</p>
              <p className="text-sm text-gray-500">{quote.items.length} productos</p>
              <p className="text-xs text-gray-500">{quote.totalHours.toFixed(1)}h</p>
            </div>
          </div>

          {/* Barra de progreso para presupuestos aprobados */}
          {quote.status === 'APPROVED' && progress && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progreso del proyecto</span>
                <span className="text-sm font-bold text-green-600">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress.percentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {progress.completed} de {progress.total} tareas completadas
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <p className="text-gray-600">Creado:</p>
              <p className="font-medium">{new Date(quote.createdAt).toLocaleDateString('es-ES')}</p>
            </div>
            <div>
              <p className="text-gray-600">Tarifa:</p>
              <p className="font-medium">
                {quote.tarifa?.name || quote.businessLine?.name || 'No asignada'}
              </p>
            </div>
            {quote.approvedAt && (
              <div>
                <p className="text-gray-600">Aprobado:</p>
                <p className="font-medium text-green-600">
                  {new Date(quote.approvedAt).toLocaleDateString('es-ES')}
                </p>
              </div>
            )}
            {quote.cancelledAt && (
              <div>
                <p className="text-gray-600">Cancelado:</p>
                <p className="font-medium text-red-600">
                  {new Date(quote.cancelledAt).toLocaleDateString('es-ES')}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {(quote.status === 'DRAFT' || quote.status === 'SENT' || quote.status === 'EXPIRED') && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(quote)}
                  disabled={quote.status === 'EXPIRED'}
                  title={quote.status === 'EXPIRED' ? 'No se puede aprobar un presupuesto caducado' : ''}
                >
                  ✅ Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditQuote(quote.id)}
                >
                  ✏️ Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancel(quote.id)}
                >
                  ❌ Cancelar
                </Button>
              </>
            )}
            
            {quote.status === 'APPROVED' && (
              <div className="flex-1 space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled
                >
                  ✅ Proyecto en curso
                </Button>
                {progress && progress.percentage === 100 && (
                  <Badge variant="success" className="w-full justify-center">
                    🎉 Proyecto completado
                  </Badge>
                )}
              </div>
            )}
            
            {(quote.status === 'REJECTED' || quote.status === 'EXPIRED') && (
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => handleDelete(quote.id)}
              >
                🗑️ Eliminar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs de categorías */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  selectedTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                <Badge 
                  variant={selectedTab === tab.key ? 'secondary' : 'outline'}
                  className="ml-2"
                >
                  {tab.count}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de presupuestos */}
      {currentQuotes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">
              No hay presupuestos {tabs.find(t => t.key === selectedTab)?.label.toLowerCase()}
            </p>
            <p className="text-sm text-gray-400">
              Los presupuestos se organizan automáticamente por estado
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentQuotes.map(quote => (
            <QuoteCard key={quote.id} quote={quote} />
          ))}
        </div>
      )}
    </div>
  )
}