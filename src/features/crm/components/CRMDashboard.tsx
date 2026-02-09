import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent } from '@/shared/components/ui/card'

export default function CRMDashboard() {
  return (
    <PageLayout>
      <Header
        title="CRM - Gestión de Clientes"
        description="105 clientes totales"
        action={{
          label: '➕ Nuevo Lead',
          onClick: () => alert('Funcionalidad próximamente'),
        }}
      />
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-2xl font-bold mb-2">Módulo CRM</h3>
            <p className="text-gray-600">
              Este módulo se implementará en el Sprint 2
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Incluirá: Import Excel, Tabla de leads, Filtros, Kanban, etc.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
