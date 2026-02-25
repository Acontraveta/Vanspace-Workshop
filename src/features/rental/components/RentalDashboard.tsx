import { useState, useEffect, useCallback, useMemo } from 'react'
import { RentalService } from '../services/rentalService'
import type {
  RentalVehicle,
  RentalBooking,
  RentalExtra,
  RentalStatus,
  BookingStatus,
} from '../types/rental.types'
import {
  RENTAL_EXTRAS,
  VEHICLE_STATUS_CONFIG,
  BOOKING_STATUS_CONFIG,
} from '../types/rental.types'

type TabType = 'flota' | 'reservas' | 'calendario'

// ════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ════════════════════════════════════════════════════════════
export default function RentalDashboard() {
  const [tab, setTab] = useState<TabType>('flota')
  const [vehicles, setVehicles] = useState<RentalVehicle[]>([])
  const [bookings, setBookings] = useState<RentalBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [v, b] = await Promise.all([
        RentalService.getVehicles(),
        RentalService.getBookings(),
      ])
      setVehicles(v)
      setBookings(b)
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'flota', label: 'Flota', icon: '🚐' },
    { key: 'reservas', label: 'Reservas', icon: '📋' },
    { key: 'calendario', label: 'Calendario', icon: '📅' },
  ]

  // Stats
  const stats = useMemo(() => {
    const disponibles = vehicles.filter(v => v.status === 'available').length
    const alquiladas = vehicles.filter(v => v.status === 'rented').length
    const reservadas = vehicles.filter(v => v.status === 'reserved').length
    const mantenimiento = vehicles.filter(v => v.status === 'maintenance').length
    const reservasActivas = bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length
    const pendientes = bookings.filter(b => b.status === 'pending').length
    const ingresosMes = bookings
      .filter(b => {
        const d = new Date(b.fecha_inicio)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && b.status !== 'cancelled'
      })
      .reduce((sum, b) => sum + (b.precio_total || 0), 0)
    return { disponibles, alquiladas, reservadas, mantenimiento, reservasActivas, pendientes, ingresosMes }
  }, [vehicles, bookings])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Cargando alquiler...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🚐 Alquiler Camper</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de flota y reservas de furgonetas camper</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Disponibles" value={stats.disponibles} color="text-green-600" bg="bg-green-50" icon="✅" />
        <StatCard label="En alquiler" value={stats.alquiladas} color="text-blue-600" bg="bg-blue-50" icon="🚐" />
        <StatCard label="Reservadas" value={stats.reservadas} color="text-amber-600" bg="bg-amber-50" icon="📋" />
        <StatCard label="Mantenimiento" value={stats.mantenimiento} color="text-orange-600" bg="bg-orange-50" icon="🔧" />
        <StatCard label="Res. activas" value={stats.reservasActivas} color="text-indigo-600" bg="bg-indigo-50" icon="📌" />
        <StatCard label="Pendientes" value={stats.pendientes} color="text-purple-600" bg="bg-purple-50" icon="⏳" />
        <StatCard label="Ingresos mes" value={`${stats.ingresosMes.toLocaleString('es-ES')} €`} color="text-emerald-600" bg="bg-emerald-50" icon="💰" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'flota' && <FlotaTab vehicles={vehicles} bookings={bookings} onRefresh={load} />}
      {tab === 'reservas' && <ReservasTab vehicles={vehicles} bookings={bookings} onRefresh={load} />}
      {tab === 'calendario' && <CalendarioTab vehicles={vehicles} bookings={bookings} />}
    </div>
  )
}

function StatCard({ label, value, color, bg, icon }: { label: string; value: string | number; color: string; bg: string; icon: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 border border-opacity-20`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className={`text-xs font-medium ${color}`}>{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// FLOTA TAB
// ════════════════════════════════════════════════════════════
function FlotaTab({ vehicles, bookings, onRefresh }: { vehicles: RentalVehicle[]; bookings: RentalBooking[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<RentalVehicle | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = statusFilter === 'all' ? vehicles : vehicles.filter(v => v.status === statusFilter)

  const handleSaveVehicle = async (data: Partial<RentalVehicle>) => {
    try {
      setSaving(true)
      if (editingVehicle) {
        await RentalService.updateVehicle(editingVehicle.id, data)
      } else {
        await RentalService.createVehicle(data as any)
      }
      setShowForm(false)
      setEditingVehicle(null)
      await onRefresh()
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (v: RentalVehicle, status: RentalStatus) => {
    try {
      await RentalService.updateVehicleStatus(v.id, status)
      await onRefresh()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Todos los estados</option>
            {Object.entries(VEHICLE_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">{filtered.length} vehículo(s)</span>
        </div>
        <button
          onClick={() => { setEditingVehicle(null); setShowForm(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Añadir vehículo
        </button>
      </div>

      {showForm && (
        <VehicleForm
          vehicle={editingVehicle}
          saving={saving}
          onSave={handleSaveVehicle}
          onCancel={() => { setShowForm(false); setEditingVehicle(null) }}
        />
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <div className="text-5xl mb-3">🚐</div>
          <p className="text-gray-500 font-medium">No hay vehículos registrados</p>
          <p className="text-gray-400 text-sm mt-1">Añade tu primera furgoneta camper</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(v => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              bookings={bookings.filter(b => b.vehicle_id === v.id)}
              onEdit={() => { setEditingVehicle(v); setShowForm(true) }}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// VEHICLE CARD
// ════════════════════════════════════════════════════════════
function VehicleCard({ vehicle, bookings, onEdit, onStatusChange }: {
  vehicle: RentalVehicle
  bookings: RentalBooking[]
  onEdit: () => void
  onStatusChange: (v: RentalVehicle, status: RentalStatus) => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const statusCfg = VEHICLE_STATUS_CONFIG[vehicle.status]
  const activeBooking = bookings.find(b => b.status === 'active')
  const nextBooking = bookings
    .filter(b => (b.status === 'confirmed' || b.status === 'pending') && new Date(b.fecha_inicio) >= new Date())
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))[0]

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Status banner */}
      <div className={`${statusCfg.color} px-4 py-2 flex items-center justify-between`}>
        <span className={`text-sm font-medium ${statusCfg.textColor}`}>
          {statusCfg.icon} {statusCfg.label}
        </span>
        <select
          value={vehicle.status}
          onChange={e => onStatusChange(vehicle, e.target.value as RentalStatus)}
          className={`text-xs ${statusCfg.color} ${statusCfg.textColor} border-none cursor-pointer font-medium bg-transparent`}
        >
          {Object.entries(VEHICLE_STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="p-4 space-y-3">
        {/* Name + model */}
        <div>
          <h3 className="text-lg font-bold text-gray-900">{vehicle.nombre}</h3>
          <p className="text-sm text-gray-500">{vehicle.modelo} {vehicle.anio ? `(${vehicle.anio})` : ''}</p>
          <p className="text-xs text-gray-400 mt-0.5">📍 {vehicle.matricula}</p>
        </div>

        {/* Key specs */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>🪑 {vehicle.plazas} plazas</span>
          <span>🛏️ {vehicle.camas} camas</span>
          {vehicle.km_actual && <span>📏 {vehicle.km_actual.toLocaleString()} km</span>}
        </div>

        {/* Pricing */}
        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-4">
          <div>
            <p className="text-xs text-gray-500">Día</p>
            <p className="text-lg font-bold text-blue-600">{vehicle.precio_dia_eur}€</p>
          </div>
          {vehicle.precio_semana_eur && (
            <div>
              <p className="text-xs text-gray-500">Semana</p>
              <p className="text-lg font-bold text-green-600">{vehicle.precio_semana_eur}€</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">Fianza</p>
            <p className="text-lg font-bold text-amber-600">{vehicle.fianza_eur}€</p>
          </div>
        </div>

        {/* Current / next booking */}
        {activeBooking && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-sm">
            <span className="font-medium text-blue-700">🚐 En alquiler:</span>
            <span className="text-blue-600 ml-1">
              {activeBooking.cliente_nombre} — hasta {new Date(activeBooking.fecha_fin).toLocaleDateString('es-ES')}
            </span>
          </div>
        )}
        {!activeBooking && nextBooking && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm">
            <span className="font-medium text-amber-700">📅 Próxima:</span>
            <span className="text-amber-600 ml-1">
              {nextBooking.cliente_nombre} — {new Date(nextBooking.fecha_inicio).toLocaleDateString('es-ES')}
            </span>
          </div>
        )}

        {/* Expand / actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {showDetails ? '▲ Menos detalles' : '▼ Más detalles'}
          </button>
          <button
            onClick={onEdit}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            ✏️ Editar
          </button>
        </div>

        {/* Expandable details */}
        {showDetails && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {vehicle.equipamiento.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Equipamiento</p>
                <div className="flex flex-wrap gap-1">
                  {vehicle.equipamiento.map((eq, i) => (
                    <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{eq}</span>
                  ))}
                </div>
              </div>
            )}
            {vehicle.proxima_itv && (
              <p className="text-xs text-gray-500">🔍 ITV: {new Date(vehicle.proxima_itv).toLocaleDateString('es-ES')}</p>
            )}
            {vehicle.proximo_mantenimiento && (
              <p className="text-xs text-gray-500">🔧 Mantenimiento: {new Date(vehicle.proximo_mantenimiento).toLocaleDateString('es-ES')}</p>
            )}
            {vehicle.notas && (
              <p className="text-xs text-gray-500 italic">{vehicle.notas}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// VEHICLE FORM
// ════════════════════════════════════════════════════════════
function VehicleForm({ vehicle, saving, onSave, onCancel }: {
  vehicle: RentalVehicle | null
  saving: boolean
  onSave: (data: Partial<RentalVehicle>) => void
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(vehicle?.nombre ?? '')
  const [matricula, setMatricula] = useState(vehicle?.matricula ?? '')
  const [modelo, setModelo] = useState(vehicle?.modelo ?? '')
  const [anio, setAnio] = useState(vehicle?.anio?.toString() ?? '')
  const [plazas, setPlazas] = useState(vehicle?.plazas?.toString() ?? '4')
  const [camas, setCamas] = useState(vehicle?.camas?.toString() ?? '2')
  const [precioDia, setPrecioDia] = useState(vehicle?.precio_dia_eur?.toString() ?? '')
  const [precioSemana, setPrecioSemana] = useState(vehicle?.precio_semana_eur?.toString() ?? '')
  const [fianza, setFianza] = useState(vehicle?.fianza_eur?.toString() ?? '500')
  const [equipamiento, setEquipamiento] = useState(vehicle?.equipamiento?.join(', ') ?? '')
  const [notas, setNotas] = useState(vehicle?.notas ?? '')
  const [kmActual, setKmActual] = useState(vehicle?.km_actual?.toString() ?? '')
  const [proximaItv, setProximaItv] = useState(vehicle?.proxima_itv ?? '')
  const [proximoMant, setProximoMant] = useState(vehicle?.proximo_mantenimiento ?? '')
  const [status, setStatus] = useState<RentalStatus>(vehicle?.status ?? 'available')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre || !matricula || !modelo || !precioDia) {
      alert('Rellena los campos obligatorios (nombre, matrícula, modelo, precio/día)')
      return
    }
    onSave({
      nombre,
      matricula,
      modelo,
      anio: anio ? parseInt(anio) : undefined,
      plazas: parseInt(plazas) || 4,
      camas: parseInt(camas) || 2,
      precio_dia_eur: parseFloat(precioDia),
      precio_semana_eur: precioSemana ? parseFloat(precioSemana) : undefined,
      fianza_eur: parseFloat(fianza) || 500,
      equipamiento: equipamiento ? equipamiento.split(',').map(s => s.trim()).filter(Boolean) : [],
      notas: notas || undefined,
      km_actual: kmActual ? parseInt(kmActual) : undefined,
      proxima_itv: proximaItv || undefined,
      proximo_mantenimiento: proximoMant || undefined,
      status,
    })
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
  const labelCls = 'text-xs font-medium text-gray-600 mb-1 block'

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
      <h3 className="text-lg font-bold text-gray-900">
        {vehicle ? '✏️ Editar vehículo' : '🚐 Nuevo vehículo'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Nombre comercial *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} placeholder="Furgo Aventura" />
        </div>
        <div>
          <label className={labelCls}>Matrícula *</label>
          <input value={matricula} onChange={e => setMatricula(e.target.value)} className={inputCls} placeholder="1234 ABC" />
        </div>
        <div>
          <label className={labelCls}>Modelo *</label>
          <input value={modelo} onChange={e => setModelo(e.target.value)} className={inputCls} placeholder="Mercedes Sprinter 316" />
        </div>
        <div>
          <label className={labelCls}>Año</label>
          <input type="number" value={anio} onChange={e => setAnio(e.target.value)} className={inputCls} placeholder="2022" />
        </div>
        <div>
          <label className={labelCls}>Plazas</label>
          <input type="number" value={plazas} onChange={e => setPlazas(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Camas</label>
          <input type="number" value={camas} onChange={e => setCamas(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Precio/día (€) *</label>
          <input type="number" step="0.01" value={precioDia} onChange={e => setPrecioDia(e.target.value)} className={inputCls} placeholder="89" />
        </div>
        <div>
          <label className={labelCls}>Precio/semana (€)</label>
          <input type="number" step="0.01" value={precioSemana} onChange={e => setPrecioSemana(e.target.value)} className={inputCls} placeholder="550" />
        </div>
        <div>
          <label className={labelCls}>Fianza (€)</label>
          <input type="number" step="0.01" value={fianza} onChange={e => setFianza(e.target.value)} className={inputCls} placeholder="500" />
        </div>
        <div>
          <label className={labelCls}>Km actual</label>
          <input type="number" value={kmActual} onChange={e => setKmActual(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Próxima ITV</label>
          <input type="date" value={proximaItv} onChange={e => setProximaItv(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Próximo mantenimiento</label>
          <input type="date" value={proximoMant} onChange={e => setProximoMant(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Estado</label>
          <select value={status} onChange={e => setStatus(e.target.value as RentalStatus)} className={inputCls}>
            {Object.entries(VEHICLE_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Equipamiento (separado por comas)</label>
          <input value={equipamiento} onChange={e => setEquipamiento(e.target.value)} className={inputCls} placeholder="Nevera, Ducha, Calefacción, Cocina, Cama abatible..." />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls}>Notas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} className={inputCls} rows={2} placeholder="Observaciones internas..." />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : vehicle ? 'Actualizar' : 'Crear vehículo'}
        </button>
      </div>
    </form>
  )
}

// ════════════════════════════════════════════════════════════
// RESERVAS TAB
// ════════════════════════════════════════════════════════════
function ReservasTab({ vehicles, bookings, onRefresh }: { vehicles: RentalVehicle[]; bookings: RentalBooking[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [editingBooking, setEditingBooking] = useState<RentalBooking | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        b.cliente_nombre?.toLowerCase().includes(q) ||
        b.cliente_telefono?.toLowerCase().includes(q) ||
        b.cliente_email?.toLowerCase().includes(q) ||
        b.vehicle?.nombre?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleSaveBooking = async (data: Partial<RentalBooking>) => {
    try {
      setSaving(true)
      if (editingBooking) {
        await RentalService.updateBooking(editingBooking.id, data)
      } else {
        await RentalService.createBooking(data as any)
      }
      setShowForm(false)
      setEditingBooking(null)
      await onRefresh()
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (b: RentalBooking, status: BookingStatus) => {
    try {
      await RentalService.updateBookingStatus(b.id, status, b.vehicle_id)
      await onRefresh()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente o vehículo..."
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-56"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Todos los estados</option>
            {Object.entries(BOOKING_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">{filtered.length} reserva(s)</span>
        </div>
        <button
          onClick={() => { setEditingBooking(null); setShowForm(true) }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Nueva reserva
        </button>
      </div>

      {showForm && (
        <BookingForm
          booking={editingBooking}
          vehicles={vehicles}
          allBookings={bookings}
          saving={saving}
          onSave={handleSaveBooking}
          onCancel={() => { setShowForm(false); setEditingBooking(null) }}
        />
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">No hay reservas</p>
          <p className="text-gray-400 text-sm mt-1">Crea la primera reserva de alquiler</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => (
            <BookingRow
              key={b.id}
              booking={b}
              onEdit={() => { setEditingBooking(b); setShowForm(true) }}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// BOOKING ROW
// ════════════════════════════════════════════════════════════
function BookingRow({ booking, onEdit, onStatusChange }: {
  booking: RentalBooking
  onEdit: () => void
  onStatusChange: (b: RentalBooking, status: BookingStatus) => void
}) {
  const statusCfg = BOOKING_STATUS_CONFIG[booking.status]
  const dias = RentalService.getDias(booking.fecha_inicio, booking.fecha_fin)

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: client + vehicle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusCfg.color} ${statusCfg.textColor}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
            {booking.pagado && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">💳 Pagado</span>}
          </div>
          <h4 className="font-bold text-gray-900 truncate">{booking.cliente_nombre}</h4>
          <p className="text-sm text-gray-500">
            🚐 {booking.vehicle?.nombre || booking.vehicle_id}
            {booking.cliente_telefono && <span className="ml-3">📞 {booking.cliente_telefono}</span>}
          </p>
        </div>

        {/* Center: dates */}
        <div className="text-sm text-gray-600 flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-400">Recogida</p>
            <p className="font-medium">{new Date(booking.fecha_inicio).toLocaleDateString('es-ES')}</p>
          </div>
          <div className="text-gray-400">→</div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Devolución</p>
            <p className="font-medium">{new Date(booking.fecha_fin).toLocaleDateString('es-ES')}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Duración</p>
            <p className="font-medium">{dias} día{dias !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Right: price + actions */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-bold text-blue-600">{booking.precio_total?.toLocaleString('es-ES')}€</p>
            <p className="text-xs text-gray-400">Fianza: {booking.fianza}€</p>
          </div>

          <div className="flex items-center gap-1">
            {booking.status === 'pending' && (
              <button
                onClick={() => onStatusChange(booking, 'confirmed')}
                className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-200 font-medium"
              >
                Confirmar
              </button>
            )}
            {booking.status === 'confirmed' && (
              <button
                onClick={() => onStatusChange(booking, 'active')}
                className="text-xs bg-green-100 text-green-700 px-2.5 py-1.5 rounded-lg hover:bg-green-200 font-medium"
              >
                Entregar
              </button>
            )}
            {booking.status === 'active' && (
              <button
                onClick={() => onStatusChange(booking, 'completed')}
                className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 font-medium"
              >
                Devolver
              </button>
            )}
            {(booking.status === 'pending' || booking.status === 'confirmed') && (
              <button
                onClick={() => onStatusChange(booking, 'cancelled')}
                className="text-xs bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-100 font-medium"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={onEdit}
              className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 font-medium"
            >
              ✏️
            </button>
          </div>
        </div>
      </div>

      {/* Extras + notes */}
      {(booking.extras?.some(e => e.incluido) || booking.notas || booking.incidencias) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs">
          {booking.extras?.filter(e => e.incluido).map((e, i) => (
            <span key={i} className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{e.nombre}</span>
          ))}
          {booking.notas && <span className="text-gray-400 italic">📝 {booking.notas}</span>}
          {booking.incidencias && <span className="text-red-500">⚠️ {booking.incidencias}</span>}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// BOOKING FORM
// ════════════════════════════════════════════════════════════
function BookingForm({ booking, vehicles, allBookings, saving, onSave, onCancel }: {
  booking: RentalBooking | null
  vehicles: RentalVehicle[]
  allBookings: RentalBooking[]
  saving: boolean
  onSave: (data: Partial<RentalBooking>) => void
  onCancel: () => void
}) {
  const [vehicleId, setVehicleId] = useState(booking?.vehicle_id ?? '')
  const [clienteNombre, setClienteNombre] = useState(booking?.cliente_nombre ?? '')
  const [clienteTelefono, setClienteTelefono] = useState(booking?.cliente_telefono ?? '')
  const [clienteEmail, setClienteEmail] = useState(booking?.cliente_email ?? '')
  const [clienteDni, setClienteDni] = useState(booking?.cliente_dni ?? '')
  const [clienteCarnet, setClienteCarnet] = useState(booking?.cliente_carnet ?? '')
  const [fechaInicio, setFechaInicio] = useState(booking?.fecha_inicio ?? '')
  const [fechaFin, setFechaFin] = useState(booking?.fecha_fin ?? '')
  const [descuento, setDescuento] = useState(booking?.descuento_pct?.toString() ?? '0')
  const [pagado, setPagado] = useState(booking?.pagado ?? false)
  const [metodoPago, setMetodoPago] = useState(booking?.metodo_pago ?? '')
  const [status, setStatus] = useState<BookingStatus>(booking?.status ?? 'pending')
  const [notas, setNotas] = useState(booking?.notas ?? '')
  const [kmSalida, setKmSalida] = useState(booking?.km_salida?.toString() ?? '')
  const [kmLlegada, setKmLlegada] = useState(booking?.km_llegada?.toString() ?? '')
  const [incidencias, setIncidencias] = useState(booking?.incidencias ?? '')
  const [extras, setExtras] = useState<RentalExtra[]>(
    booking?.extras ?? RENTAL_EXTRAS.map(e => ({ ...e }))
  )

  const selectedVehicle = vehicles.find(v => v.id === vehicleId)

  const precioCalc = useMemo(() => {
    if (!selectedVehicle || !fechaInicio || !fechaFin) return 0
    return RentalService.calcularPrecioTotal(
      selectedVehicle.precio_dia_eur,
      selectedVehicle.precio_semana_eur,
      fechaInicio,
      fechaFin,
      extras,
      parseFloat(descuento) || 0,
    )
  }, [selectedVehicle, fechaInicio, fechaFin, extras, descuento])

  const disponibilidadOk = useMemo(() => {
    if (!vehicleId || !fechaInicio || !fechaFin) return true
    return RentalService.isVehicleAvailable(allBookings, vehicleId, fechaInicio, fechaFin, booking?.id)
  }, [vehicleId, fechaInicio, fechaFin, allBookings, booking?.id])

  const toggleExtra = (idx: number) => {
    setExtras(prev => prev.map((e, i) => i === idx ? { ...e, incluido: !e.incluido } : e))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleId || !clienteNombre || !fechaInicio || !fechaFin) {
      alert('Rellena los campos obligatorios')
      return
    }
    if (!disponibilidadOk) {
      alert('El vehículo no está disponible en esas fechas')
      return
    }
    onSave({
      vehicle_id: vehicleId,
      cliente_nombre: clienteNombre,
      cliente_telefono: clienteTelefono || undefined,
      cliente_email: clienteEmail || undefined,
      cliente_dni: clienteDni || undefined,
      cliente_carnet: clienteCarnet || undefined,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      precio_total: precioCalc,
      fianza: selectedVehicle?.fianza_eur ?? 0,
      descuento_pct: parseFloat(descuento) || 0,
      pagado,
      metodo_pago: metodoPago || undefined,
      status,
      extras: extras.filter(e => e.incluido),
      notas: notas || undefined,
      km_salida: kmSalida ? parseInt(kmSalida) : undefined,
      km_llegada: kmLlegada ? parseInt(kmLlegada) : undefined,
      incidencias: incidencias || undefined,
    })
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
  const labelCls = 'text-xs font-medium text-gray-600 mb-1 block'

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-5">
      <h3 className="text-lg font-bold text-gray-900">
        {booking ? '✏️ Editar reserva' : '📋 Nueva reserva'}
      </h3>

      {/* Vehicle selection */}
      <div>
        <label className={labelCls}>Vehículo *</label>
        <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className={inputCls}>
          <option value="">Seleccionar vehículo...</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {VEHICLE_STATUS_CONFIG[v.status].icon} {v.nombre} ({v.matricula}) — {v.precio_dia_eur}€/día
            </option>
          ))}
        </select>
        {!disponibilidadOk && (
          <p className="text-xs text-red-600 mt-1">⚠️ El vehículo tiene reservas solapadas en esas fechas</p>
        )}
      </div>

      {/* Client info */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">👤 Datos del cliente</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} className={inputCls} placeholder="Juan García" />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)} className={inputCls} placeholder="+34 600 000 000" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} className={inputCls} placeholder="juan@email.com" />
          </div>
          <div>
            <label className={labelCls}>DNI/Pasaporte</label>
            <input value={clienteDni} onChange={e => setClienteDni(e.target.value)} className={inputCls} placeholder="12345678A" />
          </div>
          <div>
            <label className={labelCls}>Nº Carnet conducir</label>
            <input value={clienteCarnet} onChange={e => setClienteCarnet(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Dates + pricing */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">📅 Fechas y precio</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Fecha recogida *</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fecha devolución *</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Descuento %</label>
            <input type="number" min="0" max="100" value={descuento} onChange={e => setDescuento(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Precio total calculado</label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-lg font-bold text-blue-700">
              {precioCalc.toLocaleString('es-ES')} €
            </div>
          </div>
        </div>
      </div>

      {/* Extras */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">🎒 Extras</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {extras.map((ex, i) => (
            <label
              key={i}
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                ex.incluido
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <input
                type="checkbox"
                checked={ex.incluido}
                onChange={() => toggleExtra(i)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span>{ex.nombre}</span>
              <span className="ml-auto text-xs font-medium">{ex.precio_dia}€/d</span>
            </label>
          ))}
        </div>
      </div>

      {/* Payment + status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Estado</label>
          <select value={status} onChange={e => setStatus(e.target.value as BookingStatus)} className={inputCls}>
            {Object.entries(BOOKING_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Método de pago</label>
          <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className={inputCls}>
            <option value="">Sin especificar</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Bizum">Bizum</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pagado} onChange={e => setPagado(e.target.checked)} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
            <span className="text-sm font-medium text-gray-700">💳 Pagado</span>
          </label>
        </div>
      </div>

      {/* KM + incidencias (for active/completed bookings) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Km salida</label>
          <input type="number" value={kmSalida} onChange={e => setKmSalida(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Km llegada</label>
          <input type="number" value={kmLlegada} onChange={e => setKmLlegada(e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Incidencias</label>
          <input value={incidencias} onChange={e => setIncidencias(e.target.value)} className={inputCls} placeholder="Daños, multas, etc." />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} className={inputCls} rows={2} placeholder="Observaciones internas..." />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !disponibilidadOk}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : booking ? 'Actualizar' : 'Crear reserva'}
        </button>
      </div>
    </form>
  )
}

// ════════════════════════════════════════════════════════════
// CALENDARIO TAB
// ════════════════════════════════════════════════════════════
function CalendarioTab({ vehicles, bookings }: { vehicles: RentalVehicle[]; bookings: RentalBooking[] }) {
  const [monthOffset, setMonthOffset] = useState(0)

  const now = new Date()
  const viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Generate day headers (1..daysInMonth)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Active vehicles only
  const activeVehicles = vehicles.filter(v => v.status !== 'inactive')

  // For each vehicle, determine which days have bookings
  const getBookingsForDay = (vehicleId: string, day: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return bookings.filter(b =>
      b.vehicle_id === vehicleId &&
      b.status !== 'cancelled' &&
      b.fecha_inicio <= dayStr &&
      b.fecha_fin >= dayStr
    )
  }

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setMonthOffset(o => o - 1)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors">
          ← Anterior
        </button>
        <h3 className="text-lg font-bold text-gray-900">
          {monthNames[month]} {year}
        </h3>
        <button onClick={() => setMonthOffset(o => o + 1)} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors">
          Siguiente →
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(BOOKING_STATUS_CONFIG).filter(([k]) => k !== 'cancelled').map(([k, v]) => (
          <span key={k} className={`px-2 py-1 rounded-full ${v.color} ${v.textColor} font-medium`}>
            {v.icon} {v.label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <div className="min-w-[900px]">
          {/* Header row */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-40 flex-shrink-0 px-3 py-2 text-xs font-medium text-gray-500 border-r border-gray-200">
              Vehículo
            </div>
            {days.map(d => {
              const dayDate = new Date(year, month, d)
              const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
              const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear()
              return (
                <div
                  key={d}
                  className={`flex-1 min-w-[30px] text-center py-2 text-xs font-medium border-r border-gray-100 ${
                    isToday ? 'bg-blue-100 text-blue-700' : isWeekend ? 'bg-gray-100 text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {d}
                </div>
              )
            })}
          </div>

          {/* Vehicle rows */}
          {activeVehicles.map(v => (
            <div key={v.id} className="flex border-b border-gray-100 hover:bg-gray-50">
              <div className="w-40 flex-shrink-0 px-3 py-2 border-r border-gray-200">
                <p className="text-sm font-medium text-gray-900 truncate">{v.nombre}</p>
                <p className="text-xs text-gray-400 truncate">{v.matricula}</p>
              </div>
              {days.map(d => {
                const dayBookings = getBookingsForDay(v.id, d)
                const b = dayBookings[0]
                if (!b) {
                  return <div key={d} className="flex-1 min-w-[30px] border-r border-gray-50" />
                }
                const cfg = BOOKING_STATUS_CONFIG[b.status]
                return (
                  <div
                    key={d}
                    className={`flex-1 min-w-[30px] border-r border-gray-50 ${cfg.color} cursor-default`}
                    title={`${b.cliente_nombre} — ${cfg.label}\n${b.fecha_inicio} → ${b.fecha_fin}`}
                  />
                )
              })}
            </div>
          ))}

          {activeVehicles.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              No hay vehículos activos para mostrar
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
