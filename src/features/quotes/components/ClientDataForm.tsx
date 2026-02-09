import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'

interface ClientDataFormProps {
  // Datos básicos
  clientName: string
  setClientName: (value: string) => void
  clientEmail: string
  setClientEmail: (value: string) => void
  clientPhone: string
  setClientPhone: (value: string) => void
  vehicleModel: string
  setVehicleModel: (value: string) => void
  
  // Datos de facturación
  billingData: {
    nif: string
    fiscalName?: string
    address: string
    postalCode: string
    city: string
    province: string
    country: string
  }
  setBillingData: (data: any) => void
  
  // Estado
  disabled?: boolean
  showBillingData?: boolean
}

export default function ClientDataForm({
  clientName,
  setClientName,
  clientEmail,
  setClientEmail,
  clientPhone,
  setClientPhone,
  vehicleModel,
  setVehicleModel,
  billingData,
  setBillingData,
  disabled = false,
  showBillingData = false,
}: ClientDataFormProps) {
  
  const updateBillingData = (field: string, value: string) => {
    setBillingData({ ...billingData, [field]: value })
  }

  const isBasicDataComplete = !!(clientName && clientEmail && clientPhone)
  const isBillingDataComplete = !!(
    billingData.nif &&
    billingData.address &&
    billingData.postalCode &&
    billingData.city &&
    billingData.province &&
    billingData.country
  )

  return (
    <div className="space-y-6">
      {/* Datos Básicos del Cliente */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>👤 Datos del Cliente</CardTitle>
            {isBasicDataComplete ? (
              <Badge variant="success">✅ Completo</Badge>
            ) : (
              <Badge variant="secondary">⚠️ Incompleto</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre del Cliente <span className="text-red-500">*</span>
              </label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Juan Pérez / Empresa SL"
                disabled={disabled}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@email.com"
                disabled={disabled}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+34 600 000 000"
                disabled={disabled}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Vehículo</label>
              <Input
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Mercedes Sprinter L2H2"
                disabled={disabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos de Facturación (solo si se solicita) */}
      {showBillingData && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>📋 Datos de Facturación</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Necesarios para aprobar el presupuesto
                </p>
              </div>
              {isBillingDataComplete ? (
                <Badge variant="success">✅ Completo</Badge>
              ) : (
                <Badge variant="destructive">❌ Requerido</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  NIF/CIF <span className="text-red-500">*</span>
                </label>
                <Input
                  value={billingData.nif}
                  onChange={(e) => updateBillingData('nif', e.target.value)}
                  placeholder="12345678A / B12345678"
                  disabled={disabled}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Razón Social (si es empresa)
                </label>
                <Input
                  value={billingData.fiscalName || ''}
                  onChange={(e) => updateBillingData('fiscalName', e.target.value)}
                  placeholder="Nombre Fiscal SL"
                  disabled={disabled}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Dirección <span className="text-red-500">*</span>
                </label>
                <Input
                  value={billingData.address}
                  onChange={(e) => updateBillingData('address', e.target.value)}
                  placeholder="Calle Principal, 123, 2º B"
                  disabled={disabled}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Código Postal <span className="text-red-500">*</span>
                </label>
                <Input
                  value={billingData.postalCode}
                  onChange={(e) => updateBillingData('postalCode', e.target.value)}
                  placeholder="28001"
                  disabled={disabled}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ciudad <span className="text-red-500">*</span>
                </label>
                <Input
                  value={billingData.city}
                  onChange={(e) => updateBillingData('city', e.target.value)}
                  placeholder="Madrid"
                  disabled={disabled}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Provincia <span className="text-red-500">*</span>
                </label>
                <Input
                  value={billingData.province}
                  onChange={(e) => updateBillingData('province', e.target.value)}
                  placeholder="Madrid"
                  disabled={disabled}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  País <span className="text-red-500">*</span>
                </label>
                <Input
                  value={billingData.country}
                  onChange={(e) => updateBillingData('country', e.target.value)}
                  placeholder="España"
                  disabled={disabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}