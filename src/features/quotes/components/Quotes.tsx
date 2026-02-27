import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import QuotesTabbedList from './QuotesTabbedList'
import QuoteGenerator from './QuoteGenerator'

type LeadData = {
  lead_id: string
  clientName: string
  clientPhone?: string
  clientEmail?: string
  vehicleModel?: string
  billingData?: {
    nif: string
    fiscalName: string
    address: string
    postalCode: string
    city: string
    province: string
    country: string
  }
}

export default function Quotes() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list')
  const [editingQuoteId, setEditingQuoteId] = useState<string | undefined>(undefined)
  const [initialLeadData, setInitialLeadData] = useState<LeadData | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)

  // If navigated from CRM with a lead, open the new-quote tab pre-filled
  useEffect(() => {
    const state = location.state as { createFromLead?: LeadData; editQuoteId?: string } | null
    if (state?.createFromLead) {
      setInitialLeadData(state.createFromLead)
      setEditingQuoteId(undefined)
      setActiveTab('new')
    } else if (state?.editQuoteId) {
      setEditingQuoteId(state.editQuoteId)
      setInitialLeadData(undefined)
      setActiveTab('new')
    }
  }, [location.state])

  const handleEditQuote = (quoteId: string) => {
    setEditingQuoteId(quoteId)
    setInitialLeadData(undefined)
    setActiveTab('new')
  }

  const handleNewQuote = () => {
    setEditingQuoteId(undefined)
    setInitialLeadData(undefined)
    setActiveTab('new')
  }

  const handleBackToList = () => {
    setActiveTab('list')
    setInitialLeadData(undefined)
    setRefreshKey(prev => prev + 1)
  }

  return (
    <PageLayout>
      <Header
        title="Presupuestos"
        description="Gestiona y crea presupuestos"
      />

      <div className="p-4 md:p-8">
        {/* Tabs principales */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'list' ? 'default' : 'outline'}
                onClick={handleBackToList}
                className="flex-1"
              >
                📋 Ver Documentos
              </Button>
              <Button
                variant={activeTab === 'new' ? 'default' : 'outline'}
                onClick={handleNewQuote}
                className="flex-1"
              >
                ✏️ Nuevo Documento
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contenido según tab */}
        {activeTab === 'list' ? (
          <QuotesTabbedList key={refreshKey} onEditQuote={handleEditQuote} />
        ) : (
          <QuoteGenerator
            quoteId={editingQuoteId}
            initialLeadData={initialLeadData}
            onSaved={handleBackToList}
          />
        )}
      </div>
    </PageLayout>
  )
}