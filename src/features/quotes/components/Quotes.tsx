import { useState } from 'react'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import Quoteslist from './Quoteslist'
import QuoteGenerator from './QuoteGenerator'

export default function Quotes() {
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list')
  const [editingQuoteId, setEditingQuoteId] = useState<string | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0) // NUEVO: para forzar refresh

  const handleEditQuote = (quoteId: string) => {
    setEditingQuoteId(quoteId)
    setActiveTab('new')
  }

  const handleNewQuote = () => {
    setEditingQuoteId(undefined)
    setActiveTab('new')
  }

  const handleBackToList = () => {
    setActiveTab('list')
    setRefreshKey(prev => prev + 1) // NUEVO: forzar refresh de la lista
  }

  return (
    <PageLayout>
      <Header
        title="Presupuestos"
        description="Gestiona y crea presupuestos"
      />

      <div className="p-8">
        {/* Tabs principales */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'list' ? 'default' : 'outline'}
                onClick={handleBackToList}
                className="flex-1"
              >
                📋 Ver Presupuestos
              </Button>
              <Button
                variant={activeTab === 'new' ? 'default' : 'outline'}
                onClick={handleNewQuote}
                className="flex-1"
              >
                ➕ Nuevo Presupuesto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contenido según tab */}
        {activeTab === 'list' ? (
          <Quoteslist key={refreshKey} onEditQuote={handleEditQuote} />
        ) : (
          <QuoteGenerator quoteId={editingQuoteId} onSaved={handleBackToList} />
        )}
      </div>
    </PageLayout>
  )
}