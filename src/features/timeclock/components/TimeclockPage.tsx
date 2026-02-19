import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import TimeclockPanel from './TimeclockPanel'

export default function TimeclockPage() {
  return (
    <PageLayout>
      <Header
        title="⏰ Fichajes"
        description="Control de presencia y horas trabajadas"
      />
      <div className="p-8">
        <TimeclockPanel />
      </div>
    </PageLayout>
  )
}