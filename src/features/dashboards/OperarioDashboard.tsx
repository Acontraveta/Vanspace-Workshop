import { useState, useEffect } from 'react'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { ProductionService } from '@/features/calendar/services/productionService'
import { ProductionProject } from '@/features/calendar/types/production.types'
import { ProductionEmployee } from '@/features/config/types/config.types'
import { ConfigService } from '@/features/config/services/configService'
import { useAuth } from '@/app/providers/AuthProvider'
import TaskBoard from '@/features/production/components/TaskBoard'
import toast from 'react-hot-toast'

export default function OperarioDashboard() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProductionProject[]>([])
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMyTasks()
  }, [])

  const loadMyTasks = async () => {
    try {
      const allProjects = await ProductionService.getProjects()
      const activeProjects = allProjects.filter(p =>
        p.status === 'IN_PROGRESS' || p.status === 'SCHEDULED'
      )

      const employeeData = await ConfigService.getEmployees()
      
      setProjects(activeProjects)
      setEmployees(employeeData.filter(e => e.activo))
    } catch (error) {
      toast.error('Error cargando tareas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <Header
        title={`👷 Hola, ${user?.name || 'Operario'}`}
        description="Tus bloques de trabajo del día"
      />

      <div className="p-8">
        <TaskBoard
          projects={projects}
          employees={employees}
          onRefresh={loadMyTasks}
          viewMode="my_tasks"
          currentUserId={user?.id}
          canAssignTasks={false}
        />
      </div>
    </PageLayout>
  )
}