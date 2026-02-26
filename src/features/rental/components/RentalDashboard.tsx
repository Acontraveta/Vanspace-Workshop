import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
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
        <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap items-center gap-4">
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
          {vehicle.km_incluidos && (
            <div>
              <p className="text-xs text-gray-500">Km/día incl.</p>
              <p className="text-sm font-bold text-gray-600">{vehicle.km_incluidos} km</p>
            </div>
          )}
          {vehicle.precio_km_extra && (
            <div>
              <p className="text-xs text-gray-500">€/km extra</p>
              <p className="text-sm font-bold text-red-500">{vehicle.precio_km_extra}€</p>
            </div>
          )}
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
  const [kmIncluidos, setKmIncluidos] = useState(vehicle?.km_incluidos?.toString() ?? '200')
  const [precioKmExtra, setPrecioKmExtra] = useState(vehicle?.precio_km_extra?.toString() ?? '0.25')
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
      km_incluidos: kmIncluidos ? parseInt(kmIncluidos) : undefined,
      precio_km_extra: precioKmExtra ? parseFloat(precioKmExtra) : undefined,
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
          <label className={labelCls}>Km incluidos/día</label>
          <input type="number" value={kmIncluidos} onChange={e => setKmIncluidos(e.target.value)} className={inputCls} placeholder="200" />
        </div>
        <div>
          <label className={labelCls}>€/km extra</label>
          <input type="number" step="0.01" value={precioKmExtra} onChange={e => setPrecioKmExtra(e.target.value)} className={inputCls} placeholder="0.25" />
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
            {(booking.coste_km_extra ?? 0) > 0 && (
              <p className="text-xs text-red-500 font-medium">+ {booking.coste_km_extra}€ km extra</p>
            )}
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

      {/* Km + extras + notes */}
      {(booking.km_salida || booking.km_llegada || booking.extras?.some(e => e.incluido) || booking.notas || booking.incidencias) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs">
          {booking.km_salida != null && booking.km_llegada != null && (
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
              📏 {(booking.km_llegada - booking.km_salida).toLocaleString()} km recorridos
            </span>
          )}
          {booking.extras?.filter(e => e.incluido).map((e, i) => (
            <span key={i} className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{e.nombre}</span>
          ))}
          {booking.notas && <span className="text-gray-400 italic">📝 {booking.notas}</span>}
          {booking.incidencias && <span className="text-red-500">⚠️ {booking.incidencias}</span>}
        </div>
      )}

      {/* Photos entrega/devolucion */}
      {((booking.fotos_entrega?.length ?? 0) > 0 || (booking.fotos_devolucion?.length ?? 0) > 0) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {(booking.fotos_entrega?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">📸 Fotos entrega ({booking.fotos_entrega!.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {booking.fotos_entrega!.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Entrega ${i + 1}`} className="w-14 h-14 object-cover rounded-lg border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {(booking.fotos_devolucion?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">📸 Fotos devolución ({booking.fotos_devolucion!.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {booking.fotos_devolucion!.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Devolución ${i + 1}`} className="w-14 h-14 object-cover rounded-lg border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer" />
                  </a>
                ))}
              </div>
            </div>
          )}
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
      coste_km_extra: (kmSalida && kmLlegada && selectedVehicle?.km_incluidos && selectedVehicle?.precio_km_extra)
        ? RentalService.calcularCosteKmExtra(
            parseInt(kmSalida), parseInt(kmLlegada),
            selectedVehicle.km_incluidos, selectedVehicle.precio_km_extra,
            fechaInicio, fechaFin
          ).coste
        : 0,
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

      {/* KM + cobro extra */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">📏 Kilometraje (se registra a la entrega/devolución)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Km salida (entrega)</label>
            <input type="number" value={kmSalida} onChange={e => setKmSalida(e.target.value)} className={inputCls} placeholder="Anotar al entregar" />
          </div>
          <div>
            <label className={labelCls}>Km llegada (devolución)</label>
            <input type="number" value={kmLlegada} onChange={e => setKmLlegada(e.target.value)} className={inputCls} placeholder="Anotar al devolver" />
          </div>
          <div className="lg:col-span-2">
            {kmSalida && kmLlegada && selectedVehicle?.km_incluidos && selectedVehicle?.precio_km_extra ? (() => {
              const calc = RentalService.calcularCosteKmExtra(
                parseInt(kmSalida), parseInt(kmLlegada),
                selectedVehicle.km_incluidos, selectedVehicle.precio_km_extra,
                fechaInicio, fechaFin
              )
              return (
                <div className={`rounded-lg p-3 text-sm ${calc.kmExceso > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-gray-600">Recorridos: <b>{calc.kmRecorridos.toLocaleString()} km</b></span>
                    <span className="text-gray-600">Permitidos: <b>{calc.kmPermitidos.toLocaleString()} km</b></span>
                    {calc.kmExceso > 0 ? (
                      <>
                        <span className="text-red-600">Exceso: <b>{calc.kmExceso.toLocaleString()} km</b></span>
                        <span className="text-red-700 font-bold">Coste extra: {calc.coste.toLocaleString('es-ES')}€</span>
                      </>
                    ) : (
                      <span className="text-green-600 font-medium">✅ Dentro del límite</span>
                    )}
                  </div>
                </div>
              )
            })() : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-400">
                {selectedVehicle?.km_incluidos
                  ? `${selectedVehicle.km_incluidos} km/día incluidos · ${selectedVehicle.precio_km_extra ?? 0}€/km extra`
                  : 'Sin límite de km configurado para este vehículo'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Incidencias</label>
          <input value={incidencias} onChange={e => setIncidencias(e.target.value)} className={inputCls} placeholder="Daños, multas, etc." />
        </div>
      </div>

      {/* Fotos entrega / devolución */}
      {booking ? (
        <div className="space-y-4">
          <PhotoUploadSection
            bookingId={booking.id}
            phase="entrega"
            label="📸 Fotos al entregar (antes del alquiler)"
            existingUrls={booking.fotos_entrega ?? []}
          />
          <PhotoUploadSection
            bookingId={booking.id}
            phase="devolucion"
            label="📸 Fotos al devolver (después del alquiler)"
            existingUrls={booking.fotos_devolucion ?? []}
          />
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500 flex items-center gap-2">
          <span className="text-lg">📸</span>
          <span>Las fotos de entrega y devolución se pueden añadir después de crear la reserva (editando).</span>
        </div>
      )}

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
// PHOTO UPLOAD SECTION
// ════════════════════════════════════════════════════════════
function PhotoUploadSection({ bookingId, phase, label, existingUrls }: {
  bookingId: string
  phase: 'entrega' | 'devolucion'
  label: string
  existingUrls: string[]
}) {
  const [photos, setPhotos] = useState<string[]>(existingUrls)
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    try {
      setUploading(true)
      const updated = await RentalService.uploadBookingPhotos(bookingId, imageFiles, phase)
      setPhotos(updated)
    } catch (err: any) {
      alert('Error subiendo fotos: ' + (err.message || 'Error desconocido'))
    } finally {
      setUploading(false)
      // Reset inputs
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }

  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (url: string) => {
    setDeleting(url)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const url = deleting
    setDeleting(null)
    try {
      const updated = await RentalService.deleteBookingPhoto(bookingId, url, phase)
      setPhotos(updated)
    } catch (err: any) {
      alert('Error eliminando foto: ' + err.message)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            🖼️ Galería
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            📷 Cámara
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          Subiendo fotos...
        </div>
      )}

      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group">
              <img
                src={url}
                alt={`${phase} ${i + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => setLightboxUrl(url)}
              />
              <button
                type="button"
                onClick={() => handleDelete(url)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Sin fotos. Usa los botones de arriba para añadir.</p>
      )}

      {/* Lightbox — rendered via portal to avoid removeChild issues */}
      {lightboxUrl && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Detalle" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 text-lg"
            >
              ×
            </button>
            <a
              href={lightboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 text-xs bg-white/90 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-white font-medium"
            >
              🔗 Abrir original
            </a>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation — rendered via portal */}
      {deleting && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-xl p-5 shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar esta foto?</p>
            <p className="text-xs text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={confirmDelete} className="text-sm px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600">Eliminar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// CALENDARIO TAB
// ════════════════════════════════════════════════════════════
function CalendarioTab({ vehicles, bookings }: { vehicles: RentalVehicle[]; bookings: RentalBooking[] }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null)

  const now = new Date()
  const viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const activeVehicles = vehicles.filter(v => v.status !== 'inactive')

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

  // Build a map: vehicleId -> array of booking segments visible this month
  const vehicleBookingSegments = useMemo(() => {
    const map: Record<string, { booking: RentalBooking; startDay: number; endDay: number }[]> = {}
    for (const v of activeVehicles) {
      map[v.id] = []
    }
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    for (const b of bookings) {
      if (b.status === 'cancelled') continue
      if (b.fecha_fin < monthStart || b.fecha_inicio > monthEnd) continue
      if (!map[b.vehicle_id]) continue

      const bStart = new Date(b.fecha_inicio)
      const bEnd = new Date(b.fecha_fin)
      const startDay = bStart < new Date(monthStart) ? 1 : bStart.getDate()
      const endDay = bEnd > new Date(monthEnd) ? daysInMonth : bEnd.getDate()

      map[b.vehicle_id].push({ booking: b, startDay, endDay })
    }
    return map
  }, [activeVehicles, bookings, year, month, daysInMonth])

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonthOffset(o => o - 1)}
          className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Anterior
        </button>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900">{monthNames[month]} {year}</h3>
          {monthOffset !== 0 && (
            <button onClick={() => setMonthOffset(0)} className="text-xs text-blue-600 hover:underline">
              Ir a hoy
            </button>
          )}
        </div>
        <button
          onClick={() => setMonthOffset(o => o + 1)}
          className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center gap-1"
        >
          Siguiente
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(BOOKING_STATUS_CONFIG).filter(([k]) => k !== 'cancelled').map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${v.color} border border-opacity-30`} />
            <span className="text-gray-600">{v.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-200 border border-blue-300" />
          <span className="text-gray-600">Hoy</span>
        </span>
      </div>

      {/* Calendar table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full border-collapse" style={{ minWidth: `${160 + daysInMonth * 32}px` }}>
          <thead>
            {/* Day-of-week row */}
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 w-40 min-w-[160px] border-b border-r border-gray-200 px-3 py-1.5 text-left text-xs font-medium text-gray-400">
                Vehículo
              </th>
              {days.map(d => {
                const dayDate = new Date(year, month, d)
                const dow = dayDate.getDay()
                const isWeekend = dow === 0 || dow === 6
                return (
                  <th key={`dow-${d}`} className={`border-b border-gray-200 px-0 py-1 text-center text-[10px] font-normal w-8 min-w-[32px] ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                    {dayNames[dow]}
                  </th>
                )
              })}
            </tr>
            {/* Day number row */}
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200" />
              {days.map(d => {
                const dayDate = new Date(year, month, d)
                const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
                const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear()
                return (
                  <th
                    key={`num-${d}`}
                    className={`border-b border-gray-200 px-0 py-1.5 text-center text-xs font-semibold w-8 min-w-[32px] ${
                      isToday ? 'bg-blue-100 text-blue-700' : isWeekend ? 'bg-red-50/50 text-red-400' : 'text-gray-600'
                    }`}
                  >
                    {d}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {activeVehicles.map(v => {
              const segments = vehicleBookingSegments[v.id] ?? []
              const statusIcon = VEHICLE_STATUS_CONFIG[v.status].icon

              return (
                <tr key={v.id} className="group hover:bg-gray-50/50">
                  {/* Vehicle name cell */}
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{statusIcon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">{v.nombre}</p>
                        <p className="text-[10px] text-gray-400 truncate leading-tight">{v.matricula}</p>
                      </div>
                    </div>
                  </td>
                  {/* Day cells - use relative positioning for the bar overlay approach */}
                  {days.map(d => {
                    const dayDate = new Date(year, month, d)
                    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6
                    const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear()
                    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    const seg = segments.find(s => d >= s.startDay && d <= s.endDay)

                    if (!seg) {
                      return (
                        <td
                          key={d}
                          className={`border-b border-gray-100 w-8 min-w-[32px] h-10 ${
                            isToday ? 'bg-blue-50/60' : isWeekend ? 'bg-red-50/30' : ''
                          }`}
                        />
                      )
                    }

                    const cfg = BOOKING_STATUS_CONFIG[seg.booking.status]
                    const isStart = d === seg.startDay
                    const isEnd = d === seg.endDay
                    const isHovered = hoveredBooking === seg.booking.id

                    // Bar styling
                    const barColorMap: Record<string, string> = {
                      pending: 'bg-amber-300',
                      confirmed: 'bg-blue-400',
                      active: 'bg-green-400',
                      completed: 'bg-gray-300',
                    }
                    const barColor = barColorMap[seg.booking.status] ?? 'bg-gray-300'

                    return (
                      <td
                        key={d}
                        className={`border-b border-gray-100 w-8 min-w-[32px] h-10 p-0 relative ${
                          isToday ? 'bg-blue-50/60' : isWeekend ? 'bg-red-50/30' : ''
                        }`}
                        onMouseEnter={() => setHoveredBooking(seg.booking.id)}
                        onMouseLeave={() => setHoveredBooking(null)}
                      >
                        <div
                          className={`absolute inset-y-1.5 inset-x-0 ${barColor} ${
                            isStart ? 'ml-0.5 rounded-l-md' : ''
                          } ${isEnd ? 'mr-0.5 rounded-r-md' : ''} ${
                            isHovered ? 'ring-2 ring-offset-0 ring-gray-600/50 z-20' : ''
                          } transition-all`}
                          title={`${seg.booking.cliente_nombre}\n${cfg.label} · ${seg.booking.fecha_inicio} → ${seg.booking.fecha_fin}\n${seg.booking.precio_total?.toLocaleString('es-ES')}€`}
                        >
                          {/* Show client name on start cell */}
                          {isStart && (
                            <span className="absolute inset-0 flex items-center pl-1.5 text-[10px] font-medium text-white truncate whitespace-nowrap pointer-events-none drop-shadow-sm" style={{ width: `${(seg.endDay - seg.startDay + 1) * 32 - 8}px` }}>
                              {seg.booking.cliente_nombre}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {activeVehicles.length === 0 && (
              <tr>
                <td colSpan={daysInMonth + 1} className="p-12 text-center text-gray-400 text-sm">
                  No hay vehículos activos para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hovered booking detail */}
      {hoveredBooking && (() => {
        const b = bookings.find(x => x.id === hoveredBooking)
        if (!b) return null
        const cfg = BOOKING_STATUS_CONFIG[b.status]
        const dias = RentalService.getDias(b.fecha_inicio, b.fecha_fin)
        return (
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm animate-in fade-in duration-150">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.textColor}`}>
                {cfg.icon} {cfg.label}
              </span>
              <span className="font-bold text-gray-900">{b.cliente_nombre}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-600">
              <div>🚐 {b.vehicle?.nombre}</div>
              <div>📅 {dias} día{dias !== 1 ? 's' : ''}</div>
              <div>💰 {b.precio_total?.toLocaleString('es-ES')}€</div>
              <div>
                {b.fecha_inicio && new Date(b.fecha_inicio).toLocaleDateString('es-ES')}
                {' → '}
                {b.fecha_fin && new Date(b.fecha_fin).toLocaleDateString('es-ES')}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
