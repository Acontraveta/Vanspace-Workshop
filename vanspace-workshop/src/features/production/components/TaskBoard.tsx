import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent } from '@/shared/components/ui/card'

export default function TaskBoard() {
  return (
    <PageLayout>
      <Header
        title="Producción - Tablero de Tareas"
        description="Gestión de tareas y proyectos"
      />
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">🔧</div>
            <h3 className="text-2xl font-bold mb-2">Tablero de Producción</h3>
            <p className="text-gray-600">
              Este módulo se implementará en el Sprint 4
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Incluirá: Kanban, Cronómetros, Fotos, Parte de homologación
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
