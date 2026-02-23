/**
 * ScheduleReceptionModal.tsx
 *
 * Modal for scheduling a vehicle reception event from the CRM lead view.
 * Creates a RECEPCION calendar event with the agreed date and shows
 * the VehicleDepositReceipt when done.
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { UnifiedCalendarService } from '@/features/calendar/services/calendarService'
import type { CalendarEventForm } from '@/features/calendar/types/calendar.types'
import type { Lead } from '../types/crm.types'
import VehicleDepositReceipt from './VehicleDepositReceipt'
import toast from 'react-hot-toast'

interface ScheduleReceptionModalProps {
  lead: Lead
  onClose: () => void
}

export default function ScheduleReceptionModal({ lead, onClose }: ScheduleReceptionModalProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [savedDate, setSavedDate] = useState('')
  const [savedTime, setSavedTime] = useState('')

  const handleCreate = async () => {
    if (!date) {
      toast.error('La fecha de recepción es obligatoria')
      return
    }

    setSaving(true)
    try {
      const form: CalendarEventForm = {
        title: `🚐 Recepción — ${lead.cliente}`,
        description: notes || `Recepción del vehículo ${lead.vehiculo || ''} de ${lead.cliente}`,
        date,
        endDate: '',
        time,
        branch: 'crm',
        eventType: 'RECEPCION',
        clientName: lead.cliente || '',
        vehicleModel: lead.vehiculo || '',
        plate: '',
        projectNumber: '',
        leadId: lead.id,
        visibleRoles: ['admin', 'encargado', 'encargado_taller', 'compras'],
      }

      await UnifiedCalendarService.createEvent(form)
      toast.success('Evento de recepción creado en el calendario')
      setSavedDate(date)
      setSavedTime(time)
      setShowReceipt(true)
    } catch (err: any) {
      toast.error(err?.message ?? 'Error creando el evento')
    } finally {
      setSaving(false)
    }
  }

  // After creating the event, show the deposit receipt
  if (showReceipt) {
    return (
      <VehicleDepositReceipt
        lead={lead}
        receptionDate={savedDate}
        receptionTime={savedTime}
        onClose={onClose}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <div>
                <CardTitle className="text-lg">Programar recepción</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  {lead.cliente} — {lead.vehiculo || 'Sin vehículo'}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={onClose}>✕</Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            📌 Acuerda la fecha con el cliente y registra el evento de recepción del vehículo.
            Se creará automáticamente en el calendario (rama CRM).
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora (opcional)
              </label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Indicaciones sobre la recepción..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Cliente:</span>
              <span className="font-medium">{lead.cliente || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vehículo:</span>
              <span className="font-medium">{lead.vehiculo || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Teléfono:</span>
              <span className="font-medium">{lead.telefono || '-'}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleCreate}
              disabled={saving || !date}
              className="flex-1"
            >
              {saving ? '⏳ Creando...' : '✅ Crear evento y generar resguardo'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
