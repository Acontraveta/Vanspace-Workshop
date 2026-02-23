import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import {
  CalendarEvent,
  CalendarEventForm,
  EventBranch,
  EventType,
  BRANCH_META,
  EVENT_TYPE_LABELS,
  EVENT_TYPES_BY_BRANCH,
  ROLES_BY_BRANCH,
  emptyEventForm,
} from '../types/calendar.types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface EventModalProps {
  /** Pass an event to VIEW/EDIT it; undefined to CREATE a new one */
  event?: CalendarEvent
  /** Pre-fill the date (for clicking a day cell) */
  initialDate?: string
  /** Whether the current user can edit/delete events */
  canEdit?: boolean
  onClose: () => void
  onCreate?: (form: CalendarEventForm) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

const ALL_ROLES = ['admin', 'encargado', 'encargado_taller', 'compras', 'operario'] as const
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  encargado: 'Encargado',
  encargado_taller: 'Enc. Taller',
  compras: 'Compras',
  operario: 'Operario',
}

export default function EventModal({
  event,
  initialDate,
  canEdit = false,
  onClose,
  onCreate,
  onDelete,
}: EventModalProps) {
  const isView = !!event
  const [editing, setEditing] = useState(!isView)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [form, setForm] = useState<CalendarEventForm>(() => {
    if (event) {
      return {
        title: event.title,
        description: event.description ?? '',
        date: event.date,
        endDate: event.endDate ?? '',
        time: event.time ?? '',
        branch: event.branch,
        eventType: (event.eventType as EventType) || 'NOTA',
        clientName: event.metadata?.clientName ?? '',
        vehicleModel: event.metadata?.vehicleModel ?? '',
        plate: event.metadata?.plate ?? '',
        projectNumber: event.metadata?.projectNumber ?? '',
        leadId: event.metadata?.leadId ?? '',
        visibleRoles: event.visibleRoles,
      }
    }
    const base = emptyEventForm()
    if (initialDate) base.date = initialDate
    return base
  })

  // When branch changes, reset eventType to the first of the new branch
  const handleBranchChange = (branch: EventBranch) => {
    const types = EVENT_TYPES_BY_BRANCH[branch]
    setForm((f) => ({ ...f, branch, eventType: types[0] ?? 'NOTA' }))
  }

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      visibleRoles: f.visibleRoles.includes(role)
        ? f.visibleRoles.filter((r) => r !== role)
        : [...f.visibleRoles, role],
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('El título es obligatorio'); return }
    if (!form.date) { toast.error('La fecha es obligatoria'); return }
    if (form.visibleRoles.length === 0) { toast.error('Selecciona al menos un rol'); return }

    setSaving(true)
    try {
      await onCreate?.(form)
      toast.success(isView ? 'Evento actualizado' : 'Evento creado')
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Error guardando evento')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!event) return
    setDeleting(true)
    try {
      await onDelete?.(event.id)
      toast.success('Evento eliminado')
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Error eliminando evento')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const meta = BRANCH_META[form.branch]
  const isCRM = form.branch === 'crm'
  const isProduction = form.branch === 'produccion'
  const isReadOnly = isView && !editing

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">{meta.icon}</span>
              <div className="min-w-0">
                <CardTitle className="text-lg leading-tight truncate">
                  {isView ? event!.title : 'Nuevo evento'}
                </CardTitle>
                <div className="mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  {isView && (
                    <span className="ml-2 text-xs text-gray-500">
                      {EVENT_TYPE_LABELS[event!.eventType] ?? event!.eventType}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {isView && canEdit && !editing && (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  ✏️ Editar
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* View mode: read-only summary */}
          {isReadOnly ? (
            <div className="space-y-3">
              <InfoRow label="Fecha" value={
                event!.endDate && event!.endDate !== event!.date
                  ? `${format(parseISO(event!.date), 'dd/MM/yyyy', { locale: es })} → ${format(parseISO(event!.endDate), 'dd/MM/yyyy', { locale: es })}`
                  : `${format(parseISO(event!.date), "EEEE, d 'de' MMMM yyyy", { locale: es })}${event!.time ? ' · ' + event!.time : ''}`
              } />
              {event!.description && <InfoRow label="Descripción" value={event!.description} />}
              {event!.metadata?.clientName && <InfoRow label="Cliente" value={event!.metadata.clientName} />}
              {event!.metadata?.vehicleModel && <InfoRow label="Vehículo" value={event!.metadata.vehicleModel} />}
              {event!.metadata?.plate && <InfoRow label="Matrícula" value={event!.metadata.plate} />}
              {event!.metadata?.projectNumber && <InfoRow label="Nº Proyecto" value={event!.metadata.projectNumber} />}

              <div>
                <p className="text-xs text-gray-500 mb-1">Roles que ven este evento</p>
                <div className="flex flex-wrap gap-1">
                  {event!.visibleRoles.map((r) => (
                    <span key={r} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Delete */}
              {canEdit && !isProduction && (
                <div className="pt-2 border-t">
                  {confirmDelete ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-red-600">¿Confirmar eliminación?</span>
                      <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                        {deleting ? '...' : 'Eliminar'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => setConfirmDelete(true)}>
                      🗑️ Eliminar evento
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Edit / Create mode */
            <div className="space-y-4">
              {/* Production projects are read-only — can't create from here */}
              {isProduction && isView && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  Los proyectos de producción se gestionan desde la sección de Producción.
                </div>
              )}

              {/* Branch selector (only when creating) */}
              {!isView && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rama</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(BRANCH_META) as EventBranch[])
                      .filter((b) => b !== 'produccion')
                      .map((b) => {
                        const m = BRANCH_META[b]
                        const active = form.branch === b
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => handleBranchChange(b)}
                            className={`px-3 py-1.5 rounded-full text-sm border transition
                              ${active ? `${m.bgClass} ${m.borderClass} ${m.textClass} font-medium` : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}
                          >
                            {m.icon} {m.label}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Event type */}
              {!isProduction && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TYPES_BY_BRANCH[form.branch]
                      .filter((t) => t !== 'PROYECTO_SPAN' && t !== 'PROYECTO_INICIO' && t !== 'PROYECTO_FIN')
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, eventType: t }))}
                          className={`px-3 py-1 rounded text-sm border transition
                            ${form.eventType === t
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}
                        >
                          {EVENT_TYPE_LABELS[t] ?? t}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={isCRM ? 'Ej: Recepción vehículo Juan García' : 'Título del evento'}
                />
              </div>

              {/* CRM-specific fields */}
              {isCRM && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Nombre cliente</label>
                    <Input
                      value={form.clientName}
                      onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                      placeholder="Nombre del cliente"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Matrícula</label>
                    <Input
                      value={form.plate}
                      onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
                      placeholder="1234 ABC"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Modelo de vehículo</label>
                    <Input
                      value={form.vehicleModel}
                      onChange={(e) => setForm((f) => ({ ...f, vehicleModel: e.target.value }))}
                      placeholder="Ej: Mercedes Sprinter 314"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Nº Proyecto (si aplica)</label>
                    <Input
                      value={form.projectNumber}
                      onChange={(e) => setForm((f) => ({ ...f, projectNumber: e.target.value }))}
                      placeholder="VS-2024-001"
                    />
                  </div>
                </div>
              )}

              {/* Date + End Date + Time */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Fecha <span className="text-red-500">*</span></label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Fecha fin (opc.)</label>
                  <Input
                    type="date"
                    value={form.endDate}
                    min={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Hora (opc.)</label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Notas adicionales..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Visible roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visible para <span className="text-xs font-normal text-gray-500">(quién puede verlo)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((role) => {
                    const checked = form.visibleRoles.includes(role)
                    const suggested = ROLES_BY_BRANCH[form.branch].includes(role)
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-3 py-1 rounded-full text-xs border transition
                          ${checked
                            ? 'bg-gray-800 text-white border-gray-800'
                            : suggested
                            ? 'bg-gray-100 text-gray-600 border-gray-300 hover:border-gray-400'
                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                      >
                        {checked ? '✓ ' : ''}{ROLE_LABELS[role]}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Por defecto para {BRANCH_META[form.branch].label}: {ROLES_BY_BRANCH[form.branch].map(r => ROLE_LABELS[r]).join(', ')}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? '⏳ Guardando...' : isView ? '💾 Guardar cambios' : '✅ Crear evento'}
                </Button>
                <Button variant="outline" onClick={isView ? () => setEditing(false) : onClose}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Small helper ────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  )
}
