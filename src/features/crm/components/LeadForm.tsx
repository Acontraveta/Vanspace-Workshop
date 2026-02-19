import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lead, LeadFormData } from '../types/crm.types'
import { useCRMStore } from '../store/crmStore'
import { ALL_STATUSES } from '../utils/crmHelpers'
import { QuoteService } from '@/features/quotes/services/quoteService'
import { LeadProductionPanel } from './LeadProductionPanel'
import { LeadDocuments } from './LeadDocuments'

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
      if (lead) {
        await updateLead(lead.id, form)
      } else {
        await createLead(form)
      }
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  return (
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
                  <input
                    value={form.telefono ?? ''}
                    onChange={e => set('telefono', e.target.value)}
                    className={inputCls}
                    placeholder="+34 600 000 000"
                  />
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
