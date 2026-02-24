import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lead, LeadFormData, LeadOpportunity } from '../types/crm.types'
import { useCRMStore } from '../store/crmStore'
import { ALL_STATUSES, getStatusConfig } from '../utils/crmHelpers'
import { QuoteService } from '@/features/quotes/services/quoteService'
import { LeadProductionPanel } from './LeadProductionPanel'
import { LeadDocuments } from './LeadDocuments'
import ScheduleReceptionModal from './ScheduleReceptionModal'
import VehicleDepositReceipt from './VehicleDepositReceipt'
import { openWhatsApp } from '../utils/whatsappHelper'
import { UnifiedCalendarService } from '@/features/calendar/services/calendarService'
import type { CalendarEventForm } from '@/features/calendar/types/calendar.types'
import toast from 'react-hot-toast'

interface LeadFormProps {
  lead?: Lead | null    // If provided → edit mode; else → create mode
  onClose: () => void
}

const EMPTY_FORM: LeadFormData = {
  cliente: '',
  fecha: new Date().toISOString().split('T')[0],
  mes: '',
  asignado: '',
  telefono: '',
  email: '',
  localidad: '',
  provincia: '',
  region: '',
  origen: '',
  vehiculo: '',
  talla: '',
  viaj_dorm: '',
  linea_negocio: '',
  estado: 'Nuevo',
  importe: undefined,
  proxima_accion: '',
  fecha_accion: null,
  notas: '',
  fecha_entrega: null,
  satisfaccion: '',
  incidencias: '',
  resena: '',
}

export function LeadForm({ lead, onClose }: LeadFormProps) {
  const navigate = useNavigate()
  const { createLead, updateLead } = useCRMStore()
  const [form, setForm] = useState<LeadFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReceptionModal, setShowReceptionModal] = useState(false)
  const [showDepositReceipt, setShowDepositReceipt] = useState(false)
  const [editingOppId, setEditingOppId] = useState<string | null>(null)
  const [oppForm, setOppForm] = useState<Partial<LeadOpportunity>>({})

  // Quotes linked to this lead (read-only view)
  const linkedQuotes = useMemo(
    () => (lead ? QuoteService.getAllQuotes().filter(q => q.lead_id === lead.id) : []),
    [lead]
  )

  useEffect(() => {
    if (lead) {
      const { id, created_at, updated_at, synced_at, ...rest } = lead
      setForm({ ...EMPTY_FORM, ...rest })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [lead])

  const set = (key: keyof LeadFormData, value: any) =>
    setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.cliente.trim()) {
      setError('El nombre del cliente es obligatorio')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let savedLead: Lead
      if (lead) {
        savedLead = await updateLead(lead.id, form)
      } else {
        savedLead = await createLead(form)
      }

      // Auto-create calendar event when próxima acción + fecha are set/changed
      const actionChanged = form.proxima_accion && form.fecha_accion &&
        (form.proxima_accion !== (lead?.proxima_accion ?? '') ||
         form.fecha_accion !== (lead?.fecha_accion ?? ''))

      if (actionChanged) {
        try {
          const evtForm: CalendarEventForm = {
            title: `📌 ${form.proxima_accion} — ${form.cliente}`,
            description: `Acción CRM: ${form.proxima_accion}\nCliente: ${form.cliente}${form.vehiculo ? `\nVehículo: ${form.vehiculo}` : ''}${form.notas ? `\nNotas: ${form.notas}` : ''}`,
            date: form.fecha_accion!,
            endDate: '',
            time: '',
            branch: 'crm',
            eventType: 'RECORDATORIO',
            clientName: form.cliente,
            vehicleModel: form.vehiculo ?? '',
            plate: '',
            projectNumber: '',
            leadId: savedLead.id,
            visibleRoles: ['admin', 'encargado', 'compras'],
          }
          await UnifiedCalendarService.createEvent(evtForm)
          toast.success(`📅 Acción "${form.proxima_accion}" añadida al calendario`)
        } catch {
          // Non-blocking — lead was saved successfully
          console.warn('No se pudo crear evento de calendario para la acción CRM')
        }
      }

      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  // Archive current commercial state and start a new opportunity cycle
  const handleNewOpportunity = async () => {
    if (!lead) return
    const prev: LeadOpportunity = {
      id: `opp-${Date.now()}`,
      estado: form.estado ?? lead.estado ?? 'Desconocido',
      importe: form.importe ?? lead.importe,
      linea_negocio: form.linea_negocio ?? lead.linea_negocio,
      vehiculo: form.vehiculo ?? lead.vehiculo,
      notas: form.notas ?? lead.notas,
      fecha_inicio: lead.fecha ?? lead.created_at?.split('T')[0],
      fecha_entrega: (form.fecha_entrega ?? lead.fecha_entrega) || undefined,
      satisfaccion: form.satisfaccion ?? lead.satisfaccion,
      created_at: new Date().toISOString(),
    }
    const existing: LeadOpportunity[] = lead.oportunidades ?? []
    const newOportunidades = [...existing, prev]

    setSaving(true)
    setError(null)
    try {
      await updateLead(lead.id, {
        ...form,
        oportunidades: newOportunidades as any,
        estado: 'Nuevo',
        importe: undefined,
        linea_negocio: '',
        vehiculo: '',
        notas: '',
        fecha_entrega: null,
        satisfaccion: '',
        incidencias: '',
        resena: '',
        fecha: new Date().toISOString().split('T')[0],
        proxima_accion: '',
        fecha_accion: null,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Error creando nuevo estado comercial')
    } finally {
      setSaving(false)
    }
  }

  const opportunities: LeadOpportunity[] = lead?.oportunidades ?? []

  const handleEditOpp = (opp: LeadOpportunity) => {
    if (editingOppId === opp.id) {
      setEditingOppId(null)
      setOppForm({})
    } else {
      setEditingOppId(opp.id)
      setOppForm({ ...opp })
    }
  }

  const setOpp = (key: keyof LeadOpportunity, value: any) =>
    setOppForm(f => ({ ...f, [key]: value }))

  const handleSaveOpp = async () => {
    if (!lead || !editingOppId) return
    const updated = opportunities.map(o =>
      o.id === editingOppId ? { ...o, ...oppForm } as LeadOpportunity : o
    )
    setSaving(true)
    setError(null)
    try {
      await updateLead(lead.id, { oportunidades: updated as any })
      setEditingOppId(null)
      setOppForm({})
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando estado comercial')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOpp = async (oppId: string) => {
    if (!lead || !confirm('¿Eliminar este estado comercial del historial?')) return
    const updated = opportunities.filter(o => o.id !== oppId)
    setSaving(true)
    try {
      await updateLead(lead.id, { oportunidades: updated as any })
      if (editingOppId === oppId) { setEditingOppId(null); setOppForm({}) }
    } catch (err: any) {
      setError(err?.message ?? 'Error eliminando')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {lead ? '✏️ Editar lead' : '➕ Nuevo lead'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">

            {/* Section: Identificación */}
            <Section title="Identificación">
              <Row>
                <Field label="Cliente *">
                  <input
                    value={form.cliente}
                    onChange={e => set('cliente', e.target.value)}
                    className={inputCls}
                    placeholder="Nombre del cliente"
                    required
                  />
                </Field>
                <Field label="Teléfono">
                  <div className="flex gap-1.5">
                    <input
                      value={form.telefono ?? ''}
                      onChange={e => set('telefono', e.target.value)}
                      className={inputCls}
                      placeholder="+34 600 000 000"
                    />
                    {form.telefono && (
                      <button
                        type="button"
                        onClick={() => openWhatsApp(form.telefono!, `Hola ${form.cliente}, le contactamos desde VanSpace Workshop.`)}
                        className="shrink-0 px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition text-sm font-medium"
                        title="Contactar por WhatsApp"
                      >
                        💬
                      </button>
                    )}
                  </div>
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={e => set('email', e.target.value)}
                    className={inputCls}
                    placeholder="correo@ejemplo.com"
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Localidad">
                  <input value={form.localidad ?? ''} onChange={e => set('localidad', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Provincia">
                  <input value={form.provincia ?? ''} onChange={e => set('provincia', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Región">
                  <input value={form.region ?? ''} onChange={e => set('region', e.target.value)} className={inputCls} />
                </Field>
              </Row>
            </Section>

            {/* Section: Proyecto */}
            <Section title="Proyecto / Vehículo">
              <Row>
                <Field label="Vehículo">
                  <input value={form.vehiculo ?? ''} onChange={e => set('vehiculo', e.target.value)} className={inputCls} placeholder="Marca y modelo" />
                </Field>
                <Field label="Talla">
                  <input value={form.talla ?? ''} onChange={e => set('talla', e.target.value)} className={inputCls} placeholder="XL, L..." />
                </Field>
                <Field label="Viajero/Dormitorio">
                  <input value={form.viaj_dorm ?? ''} onChange={e => set('viaj_dorm', e.target.value)} className={inputCls} />
                </Field>
              </Row>
              <Row>
                <Field label="Línea de negocio">
                  <input value={form.linea_negocio ?? ''} onChange={e => set('linea_negocio', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Origen">
                  <input value={form.origen ?? ''} onChange={e => set('origen', e.target.value)} className={inputCls} placeholder="Web, Instagram..." />
                </Field>
                <Field label="Asignado a">
                  <input value={form.asignado ?? ''} onChange={e => set('asignado', e.target.value)} className={inputCls} />
                </Field>
              </Row>
            </Section>

            {/* Section: Estado comercial */}
            <Section title="Estado comercial">
              <Row>
                <Field label="Estado">
                  <select
                    value={form.estado ?? ''}
                    onChange={e => set('estado', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Sin estado —</option>
                    {ALL_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Importe (€)">
                  <input
                    type="number"
                    step="0.01"
                    value={form.importe ?? ''}
                    onChange={e => set('importe', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className={inputCls}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Fecha">
                  <input
                    type="date"
                    value={form.fecha ?? ''}
                    onChange={e => set('fecha', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Mes">
                  <input value={form.mes ?? ''} onChange={e => set('mes', e.target.value)} className={inputCls} placeholder="Enero" />
                </Field>
                <Field label="Próxima acción">
                  <input value={form.proxima_accion ?? ''} onChange={e => set('proxima_accion', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Fecha acción">
                  <input
                    type="date"
                    value={form.fecha_accion ?? ''}
                    onChange={e => set('fecha_accion', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </Row>
            </Section>

            {/* Estados comerciales — historial editable */}
            {lead && (
              <Section title="🔄 Estados comerciales">
                {opportunities.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {[...opportunities].reverse().map((opp, idx) => {
                      const cfg = getStatusConfig(opp.estado)
                      const isEditing = editingOppId === opp.id
                      return (
                        <div key={opp.id} className={`rounded-lg border text-sm transition-all ${isEditing ? 'ring-2 ring-indigo-400 border-indigo-300 bg-white' : `${cfg.color} ${cfg.borderColor} cursor-pointer hover:shadow-md`}`}>
                          {/* Header row — always visible, click to toggle */}
                          <div
                            className="flex items-center justify-between px-3 py-2"
                            onClick={() => handleEditOpp(opp)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">#{opportunities.length - idx}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color} ${cfg.textColor}`}>
                                {isEditing ? (oppForm.estado ?? opp.estado) : opp.estado}
                              </span>
                              {!isEditing && opp.linea_negocio && (
                                <span className="text-xs text-gray-500">{opp.linea_negocio}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              {!isEditing && opp.importe != null && (
                                <span className="font-medium text-gray-700">
                                  {opp.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                              )}
                              {!isEditing && opp.fecha_inicio && <span>{opp.fecha_inicio}</span>}
                              {!isEditing && opp.fecha_entrega && <span>→ {opp.fecha_entrega}</span>}
                              <span className="text-indigo-500 font-medium">{isEditing ? '▲ Cerrar' : '▼ Editar'}</span>
                            </div>
                          </div>

                          {/* Collapsed summary */}
                          {!isEditing && (
                            <div className="px-3 pb-2">
                              {opp.vehiculo && <p className="text-xs text-gray-500">🚐 {opp.vehiculo}</p>}
                              {opp.notas && <p className="text-xs text-gray-400 line-clamp-1">{opp.notas}</p>}
                            </div>
                          )}

                          {/* Expanded inline editor */}
                          {isEditing && (
                            <div className="px-3 pb-3 space-y-3 border-t border-gray-200 mt-1 pt-3">
                              <Row>
                                <Field label="Estado">
                                  <select value={oppForm.estado ?? ''} onChange={e => setOpp('estado', e.target.value)} className={inputCls}>
                                    <option value="">—</option>
                                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </Field>
                                <Field label="Importe (€)">
                                  <input type="number" step="0.01" value={oppForm.importe ?? ''} onChange={e => setOpp('importe', e.target.value ? parseFloat(e.target.value) : undefined)} className={inputCls} />
                                </Field>
                                <Field label="Línea de negocio">
                                  <input value={oppForm.linea_negocio ?? ''} onChange={e => setOpp('linea_negocio', e.target.value)} className={inputCls} />
                                </Field>
                              </Row>
                              <Row>
                                <Field label="Vehículo">
                                  <input value={oppForm.vehiculo ?? ''} onChange={e => setOpp('vehiculo', e.target.value)} className={inputCls} />
                                </Field>
                                <Field label="Fecha inicio">
                                  <input type="date" value={oppForm.fecha_inicio ?? ''} onChange={e => setOpp('fecha_inicio', e.target.value)} className={inputCls} />
                                </Field>
                                <Field label="Fecha entrega">
                                  <input type="date" value={oppForm.fecha_entrega ?? ''} onChange={e => setOpp('fecha_entrega', e.target.value)} className={inputCls} />
                                </Field>
                              </Row>
                              <Row>
                                <Field label="Satisfacción">
                                  <input value={oppForm.satisfaccion ?? ''} onChange={e => setOpp('satisfaccion', e.target.value)} className={inputCls} placeholder="1-5 ★" />
                                </Field>
                                <div className="sm:col-span-2">
                                  <Field label="Notas">
                                    <textarea value={oppForm.notas ?? ''} onChange={e => setOpp('notas', e.target.value)} className={`${inputCls} h-16 resize-none`} />
                                  </Field>
                                </div>
                              </Row>
                              <div className="flex items-center gap-2 pt-1">
                                <button type="button" onClick={handleSaveOpp} disabled={saving} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition font-medium">
                                  💾 Guardar
                                </button>
                                <button type="button" onClick={() => { setEditingOppId(null); setOppForm({}) }} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                                  Cancelar
                                </button>
                                <button type="button" onClick={() => handleDeleteOpp(opp.id)} disabled={saving} className="ml-auto px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition">
                                  🗑 Eliminar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleNewOpportunity}
                    disabled={saving || !form.estado || form.estado === 'Nuevo'}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition font-medium"
                  >
                    🔄 Nuevo estado comercial
                  </button>
                  <p className="text-[10px] text-gray-400 flex-1">
                    Archiva el estado comercial actual y reinicia el lead a «Nuevo» para un nuevo proyecto.
                    {opportunities.length > 0 && ` Historial: ${opportunities.length} estado(s) comercial(es).`}
                  </p>
                </div>
              </Section>
            )}

            {/* Section: Seguimiento */}
            <Section title="Seguimiento y post-venta">
              <Row>
                <Field label="Fecha entrega">
                  <input
                    type="date"
                    value={form.fecha_entrega ?? ''}
                    onChange={e => set('fecha_entrega', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Satisfacción">
                  <input value={form.satisfaccion ?? ''} onChange={e => set('satisfaccion', e.target.value)} className={inputCls} placeholder="1-5 ★" />
                </Field>
              </Row>
              <Field label="Notas">
                <textarea
                  value={form.notas ?? ''}
                  onChange={e => set('notas', e.target.value)}
                  className={`${inputCls} h-20 resize-none`}
                />
              </Field>
              <Field label="Incidencias">
                <textarea
                  value={form.incidencias ?? ''}
                  onChange={e => set('incidencias', e.target.value)}
                  className={`${inputCls} h-16 resize-none`}
                />
              </Field>
              <Field label="Reseña">
                <textarea
                  value={form.resena ?? ''}
                  onChange={e => set('resena', e.target.value)}
                  className={`${inputCls} h-16 resize-none`}
                />
              </Field>
            </Section>

            {/* Section: Estado Aprobado — datos del taller */}
            {lead && (form.estado === 'Aprobado' || lead.estado === 'Aprobado') && (
              <Section title="🔧 Proyecto aprobado — Estado del taller">
                <LeadProductionPanel lead={lead} />
              </Section>
            )}

            {/* Section: Presupuestos vinculados (solo si NO está aprobado, para no duplicar el panel) */}
            {lead && linkedQuotes.length > 0 && lead.estado !== 'Aprobado' && form.estado !== 'Aprobado' && (
              <Section title="Presupuestos vinculados">
                <div className="space-y-2">
                  {linkedQuotes.map(q => {
                    const statusLabel =
                      q.status === 'DRAFT' ? '📝 Borrador' :
                      q.status === 'SENT' ? '📤 Enviado' :
                      q.status === 'APPROVED' ? '✅ Aprobado' :
                      q.status === 'REJECTED' ? '❌ Cancelado' :
                      q.status === 'EXPIRED' ? '⏰ Caducado' : q.status
                    const statusBg =
                      q.status === 'APPROVED' ? 'bg-green-50 border-green-200' :
                      q.status === 'REJECTED' || q.status === 'EXPIRED' ? 'bg-red-50 border-red-200' :
                      'bg-blue-50 border-blue-200'
                    return (
                      <div key={q.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${statusBg}`}>
                        <div>
                          <span className="font-medium">{q.quoteNumber}</span>
                          <span className="ml-2 text-gray-500">
                            {q.createdAt instanceof Date
                              ? q.createdAt.toLocaleDateString('es-ES')
                              : String(q.createdAt).slice(0, 10)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-700 font-medium">
                            {q.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                          </span>
                          <span className="text-xs">{statusLabel}</span>
                          <button
                            type="button"
                            onClick={() => {
                              onClose()
                              navigate('/quotes', {
                                state: { editQuoteId: q.id },
                              })
                            }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Ver →
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* Section: Documentos adjuntos (solo en modo edición) */}
            {lead && (
              <Section title="📎 Documentos adjuntos">
                <LeadDocuments lead={lead} />
              </Section>
            )}

          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 ml-auto">
            {/* Crear presupuesto desde este lead (solo en modo edición) */}
            {lead && !lead.recepcion_confirmada && !lead.fecha_recepcion && (
              <button
                type="button"
                onClick={() => setShowReceptionModal(true)}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium"
              >
                🚐 Programar recepción
              </button>
            )}
            {lead && lead.fecha_recepcion && !lead.recepcion_confirmada && (
              <button
                type="button"
                onClick={() => setShowDepositReceipt(true)}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium animate-pulse"
              >
                ✅ Confirmar recepción ({lead.fecha_recepcion})
              </button>
            )}
            {lead && lead.fecha_recepcion && !lead.recepcion_confirmada && (
              <button
                type="button"
                onClick={() => setShowReceptionModal(true)}
                className="px-3 py-2 text-sm border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-50 transition"
                title="Cambiar fecha programada"
              >
                📅
              </button>
            )}
            {lead && lead.recepcion_confirmada && (
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 text-sm bg-green-100 text-green-800 rounded-lg font-medium border border-green-300">
                  ✅ Vehículo recibido
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await updateLead(lead.id, { recepcion_confirmada: false, fecha_recepcion: null, hora_recepcion: null } as any)
                    setShowReceptionModal(true)
                  }}
                  className="px-3 py-2 text-sm border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-50 transition font-medium"
                >
                  🚐 Programar nueva recepción
                </button>
              </div>
            )}
            {lead && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate('/quotes', {
                    state: {
                      createFromLead: {
                        lead_id: lead.id,
                        clientName: lead.cliente,
                        clientPhone: lead.telefono,
                        clientEmail: lead.email,
                        vehicleModel: lead.vehiculo,
                      },
                    },
                  })
                }}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                📄 Crear presupuesto
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
            >
              {saving ? 'Guardando...' : lead ? '💾 Guardar cambios' : '➕ Crear lead'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Schedule reception modal */}
    {showReceptionModal && lead && (
      <ScheduleReceptionModal
        lead={lead}
        onClose={() => setShowReceptionModal(false)}
      />
    )}

    {/* Deposit receipt (confirmar recepción) */}
    {showDepositReceipt && lead && (
      <VehicleDepositReceipt
        lead={lead}
        receptionDate={lead.fecha_recepcion ?? ''}
        receptionTime={lead.hora_recepcion ?? undefined}
        onClose={async () => {
          // Mark reception as confirmed on the lead
          try {
            await updateLead(lead.id, { recepcion_confirmada: true } as any)
          } catch { /* silent */ }
          setShowDepositReceipt(false)
          onClose()
        }}
      />
    )}
    </>
  )
}

// ── Internal layout helpers ──────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
