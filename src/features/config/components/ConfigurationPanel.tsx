import { useState } from 'react'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import TarifasConfig from './TarifasConfig'
import EmployeesConfig from './EmployeesConfig'
import GeneralSettings from './GeneralSettings'
import AlertsConfig from './AlertsConfig'
import CompanyInfoConfig from './CompanyInfoConfig'

export default function ConfigurationPanel() {
  const [activeTab, setActiveTab] = useState<'business' | 'employees' | 'settings' | 'alerts' | 'company'>('business')

  const tabs = [
    { id: 'business', label: '� Tarifas', icon: '💲' },
    { id: 'employees', label: '👥 Empleados', icon: '👥' },
    { id: 'settings', label: '⚙️ Configuración', icon: '⚙️' },
    { id: 'alerts', label: '🔔 Alertas', icon: '🔔' },
    { id: 'company', label: '🏢 Empresa', icon: '🏢' },
  ]

  return (
    <PageLayout>
      <Header
        title="⚙️ Configuración"
        description="Gestión de parámetros del sistema"
      />

      <div className="p-8">
        {/* Tabs */}
        <div className="mb-6 border-b">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-medium transition border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'business' && <TarifasConfig />}
          {activeTab === 'employees' && <EmployeesConfig />}
          {activeTab === 'settings' && <GeneralSettings />}
          {activeTab === 'alerts' && <AlertsConfig />}
          {activeTab === 'company' && <CompanyInfoConfig />}
        </div>
      </div>
    </PageLayout>
  )
}