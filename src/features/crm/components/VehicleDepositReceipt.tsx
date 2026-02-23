/**
 * VehicleDepositReceipt.tsx
 *
 * Resguardo de depósito del vehículo.
 * Se genera al crear un evento de RECEPCIÓN y muestra los datos del CRM.
 * Permite adjuntar fotos del estado del vehículo (cámara o galería)
 * que se almacenan en la carpeta de documentos del lead.
 */

import { useState, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { LeadDocumentsService, DocCategory } from '../services/leadDocumentsService'
import type { Lead } from '../types/crm.types'
import toast from 'react-hot-toast'

interface VehicleDepositReceiptProps {
  lead: Lead
  receptionDate: string
  receptionTime?: string
  onClose: () => void
}

export default function VehicleDepositReceipt({
  lead,
  receptionDate,
  receptionTime,
  onClose,
}: VehicleDepositReceiptProps) {
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [observations, setObservations] = useState('')
  const [fuelLevel, setFuelLevel] = useState('1/2')
  const [mileage, setMileage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePhotos = (files: FileList | null) => {
    if (!files) return
    const newPhotos = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setPhotos(prev => [...prev, ...newPhotos])
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleUploadAll = async () => {
    if (photos.length === 0 && !observations && !mileage) {
      toast.error('Adjunta al menos una foto o añade observaciones')
      return
    }
    setUploading(true)
    let errors = 0

    // Upload each photo
    for (const { file } of photos) {
      try {
        await LeadDocumentsService.upload(
          lead.id,
          file,
          'foto' as DocCategory,
          `Foto recepción vehículo — ${lead.vehiculo || ''} — ${receptionDate}`,
          ''
        )
      } catch {
        errors++
      }
    }

    // Save receipt data as a text document
    try {
      const receiptContent = generateReceiptText()
      const blob = new Blob([receiptContent], { type: 'text/plain' })
      const receiptFile = new File(
        [blob],
        `resguardo-deposito-${lead.cliente?.replace(/\s+/g, '_')}-${receptionDate}.txt`,
        { type: 'text/plain' }
      )
      await LeadDocumentsService.upload(
        lead.id,
        receiptFile,
        'contrato' as DocCategory,
        `Resguardo de depósito — Recepción ${receptionDate}`,
        ''
      )
    } catch {
      errors++
    }

    if (errors > 0) {
      toast.error(`${errors} archivo(s) no se pudieron subir`)
    } else {
      toast.success('Resguardo y fotos guardados correctamente')
    }
    setUploaded(true)
    setUploading(false)
  }

  const generateReceiptText = () => {
    const lines = [
      '═══════════════════════════════════════════════════',
      '         RESGUARDO DE DEPÓSITO DE VEHÍCULO',
      '               VANSPACE WORKSHOP',
      '═══════════════════════════════════════════════════',
      '',
      `Fecha de recepción: ${formatDate(receptionDate)}${receptionTime ? ` a las ${receptionTime}` : ''}`,
      '',
      '── DATOS DEL CLIENTE ──────────────────────────────',
      `Nombre:      ${lead.cliente || '-'}`,
      `Teléfono:    ${lead.telefono || '-'}`,
      `Email:       ${lead.email || '-'}`,
      `Localidad:   ${lead.localidad || '-'}`,
      `Provincia:   ${lead.provincia || '-'}`,
      '',
      '── DATOS DEL VEHÍCULO ─────────────────────────────',
      `Modelo:      ${lead.vehiculo || '-'}`,
      `Talla:       ${lead.talla || '-'}`,
      `Tipo:        ${lead.viaj_dorm || '-'}`,
      `Kilometraje: ${mileage || '-'}`,
      `Nivel comb.: ${fuelLevel}`,
      '',
      '── OBSERVACIONES ──────────────────────────────────',
      observations || '(Sin observaciones)',
      '',
      `Fotos adjuntas: ${photos.length}`,
      '',
      '══════════════════════════════════════════════════',
      'Firma del cliente:                Firma del taller:',
      '',
      '',
      '________________                  ________________',
    ]
    return lines.join('\n')
  }

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Resguardo de Depósito — ${lead.cliente}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            h1 { text-align: center; font-size: 20px; margin-bottom: 4px; }
            h2 { text-align: center; font-size: 14px; color: #666; margin-top: 0; }
            .section { margin-top: 24px; }
            .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 12px; }
            .row { display: flex; margin-bottom: 6px; font-size: 13px; }
            .label { width: 140px; font-weight: bold; color: #555; }
            .value { flex: 1; }
            .observations { margin-top: 12px; padding: 12px; background: #f9f9f9; border-radius: 4px; font-size: 13px; white-space: pre-wrap; min-height: 60px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .sig-block { text-align: center; font-size: 12px; color: #666; }
            .sig-line { width: 200px; border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; }
            .photos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
            .photos img { width: 150px; height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; }
            .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; }
          </style>
        </head>
        <body>
          <h1>🚐 Resguardo de Depósito de Vehículo</h1>
          <h2>VanSpace Workshop</h2>

          <div class="section">
            <div class="section-title">Datos del cliente</div>
            <div class="row"><span class="label">Nombre:</span><span class="value">${lead.cliente || '-'}</span></div>
            <div class="row"><span class="label">Teléfono:</span><span class="value">${lead.telefono || '-'}</span></div>
            <div class="row"><span class="label">Email:</span><span class="value">${lead.email || '-'}</span></div>
            <div class="row"><span class="label">Localidad:</span><span class="value">${lead.localidad || '-'} ${lead.provincia ? `(${lead.provincia})` : ''}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Datos del vehículo</div>
            <div class="row"><span class="label">Modelo:</span><span class="value">${lead.vehiculo || '-'}</span></div>
            <div class="row"><span class="label">Talla:</span><span class="value">${lead.talla || '-'}</span></div>
            <div class="row"><span class="label">Tipo:</span><span class="value">${lead.viaj_dorm || '-'}</span></div>
            <div class="row"><span class="label">Kilometraje:</span><span class="value">${mileage || '-'} km</span></div>
            <div class="row"><span class="label">Nivel combustible:</span><span class="value">${fuelLevel}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Fecha de recepción</div>
            <div class="row"><span class="label">Fecha:</span><span class="value">${formatDate(receptionDate)}${receptionTime ? ` a las ${receptionTime}` : ''}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Observaciones del estado</div>
            <div class="observations">${observations || '(Sin observaciones)'}</div>
          </div>

          ${photos.length > 0 ? `
          <div class="section">
            <div class="section-title">Fotos del estado (${photos.length})</div>
            <div class="photos">
              ${photos.map(p => `<img src="${p.preview}" />`).join('')}
            </div>
          </div>
          ` : ''}

          <div class="signatures">
            <div class="sig-block">
              <div class="sig-line">Firma del cliente</div>
            </div>
            <div class="sig-block">
              <div class="sig-line">Firma del taller</div>
            </div>
          </div>

          <div class="footer">Documento generado el ${new Date().toLocaleDateString('es-ES')} — VanSpace Workshop</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-2xl max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚐</span>
              <div>
                <CardTitle className="text-lg">Resguardo de Depósito</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Recepción de vehículo — {formatDate(receptionDate)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint} title="Imprimir">
                🖨️
              </Button>
              <Button size="sm" variant="outline" onClick={onClose}>✕</Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5" ref={printRef}>
          {/* Client data */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">👤 Datos del cliente</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoField label="Nombre" value={lead.cliente} />
              <InfoField label="Teléfono" value={lead.telefono} />
              <InfoField label="Email" value={lead.email} />
              <InfoField label="Localidad" value={`${lead.localidad || ''} ${lead.provincia ? `(${lead.provincia})` : ''}`} />
            </div>
          </div>

          {/* Vehicle data */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">🚐 Datos del vehículo</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoField label="Modelo" value={lead.vehiculo} />
              <InfoField label="Talla" value={lead.talla} />
              <InfoField label="Tipo" value={lead.viaj_dorm} />
              <div>
                <label className="block text-xs text-gray-500">Kilometraje</label>
                <input
                  type="number"
                  value={mileage}
                  onChange={e => setMileage(e.target.value)}
                  placeholder="Ej: 45000"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Nivel de combustible</label>
                <select
                  value={fuelLevel}
                  onChange={e => setFuelLevel(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Vacío">⬜ Vacío</option>
                  <option value="1/4">🟦 1/4</option>
                  <option value="1/2">🟦🟦 1/2</option>
                  <option value="3/4">🟦🟦🟦 3/4</option>
                  <option value="Lleno">🟦🟦🟦🟦 Lleno</option>
                </select>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">📝 Observaciones del estado</h3>
            <textarea
              rows={3}
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Anotar golpes, rayones, estado de neumáticos, desperfectos, etc."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Photos */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">📷 Fotos del estado del vehículo</h3>
            <div className="flex gap-2 mb-3 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition font-medium"
              >
                🖼️ Seleccionar imágenes
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-4 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition font-medium"
              >
                📸 Usar cámara
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handlePhotos(e.target.files)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handlePhotos(e.target.files)}
              />
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={photo.preview}
                      alt={`Foto ${i + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕
                    </button>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black bg-opacity-60 text-white px-1.5 py-0.5 rounded">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                📷 No hay fotos adjuntas. Usa la cámara o selecciona imágenes del dispositivo.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t">
            {!uploaded ? (
              <Button
                onClick={handleUploadAll}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? '⏳ Guardando...' : '💾 Guardar resguardo y fotos'}
              </Button>
            ) : (
              <div className="flex-1 text-center py-2">
                <p className="text-green-600 font-medium">✅ Resguardo guardado correctamente</p>
                <p className="text-xs text-gray-500 mt-1">Las fotos están en la documentación del lead</p>
              </div>
            )}
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className="font-medium text-gray-800">{value || '-'}</p>
    </div>
  )
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}
