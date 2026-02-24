/**
 * VehicleDepositReceipt.tsx
 *
 * Resguardo de depósito del vehículo.
 * Se genera al crear un evento de RECEPCIÓN y muestra los datos del CRM.
 * Permite adjuntar fotos del estado del vehículo (cámara o galería)
 * que se almacenan en la carpeta de documentos del lead.
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { LeadDocumentsService, DocCategory } from '../services/leadDocumentsService'
import { generatePdfBlob, downloadPdf } from '@/features/quotes/services/pdfGenerator'
import { loadCompanyInfo, LOGO_URL, type CompanyData, DEFAULT_COMPANY } from '@/shared/utils/companyInfo'
import SignaturePad from '@/shared/components/SignaturePad'
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
  const [clientSignature, setClientSignature] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [company, setCompany] = useState<CompanyData>(DEFAULT_COMPANY)

  // Load company info for document header
  useEffect(() => {
    loadCompanyInfo().then(setCompany)
  }, [])

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

    // Generate and upload PDF receipt
    try {
      const pdfEl = pdfRef.current
      if (pdfEl) {
        const blob = await generatePdfBlob(pdfEl)
        const receiptFile = new File(
          [blob],
          `resguardo-deposito-${lead.cliente?.replace(/\s+/g, '_')}-${receptionDate}.pdf`,
          { type: 'application/pdf' }
        )
        await LeadDocumentsService.upload(
          lead.id,
          receiptFile,
          'contrato' as DocCategory,
          `Resguardo de depósito — Recepción ${receptionDate}`,
          ''
        )
      }
    } catch {
      errors++
    }

    if (errors > 0) {
      toast.error(`${errors} archivo(s) no se pudieron subir`)
    } else {
      toast.success('Resguardo PDF y fotos guardados correctamente')
    }
    setUploaded(true)
    setUploading(false)
  }

  const handleDownloadPdf = async () => {
    const pdfEl = pdfRef.current
    if (!pdfEl) return
    try {
      const filename = `resguardo-deposito-${lead.cliente?.replace(/\s+/g, '_')}-${receptionDate}.pdf`
      await downloadPdf(filename, pdfEl)
    } catch (err) {
      toast.error('Error generando PDF')
    }
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
              <Button size="sm" variant="outline" onClick={handleDownloadPdf} title="Descargar PDF">
                📥 PDF
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

          {/* Client signature */}
          <SignaturePad
            label="Firma del cliente"
            height={140}
            onChange={setClientSignature}
          />

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

      {/* ── Hidden A4 PDF template for pdf generation ── */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <div
          ref={pdfRef}
          style={{
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '11px',
            color: '#1a1a1a',
            background: '#fff',
            width: '210mm',
            minHeight: '297mm',
            padding: '14mm',
            boxSizing: 'border-box',
            lineHeight: 1.5,
          }}
        >
          {/* Header with logo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #d97706', paddingBottom: '6mm', marginBottom: '8mm' }}>
            <div>
              {company.logoUrl && (
                <img src={company.logoUrl} alt="logo" style={{ height: '50px', marginBottom: '4px', display: 'block', objectFit: 'contain' }} crossOrigin="anonymous" />
              )}
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{company.name}</div>
              {company.nif && <div style={{ color: '#555', fontSize: '10px' }}>NIF: {company.nif}</div>}
              {company.address && <div style={{ color: '#555', fontSize: '10px' }}>{company.address}</div>}
              {(company.phone || company.email) && (
                <div style={{ color: '#555', fontSize: '10px' }}>{[company.phone, company.email].filter(Boolean).join(' · ')}</div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ background: '#d97706', color: '#fff', padding: '5px 16px', borderRadius: '5px', fontWeight: 700, fontSize: '14px', letterSpacing: '1px' }}>
                RESGUARDO DE DEPÓSITO
              </div>
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#6b7280' }}>
                {formatDate(receptionDate)}{receptionTime ? ` — ${receptionTime}` : ''}
              </div>
            </div>
          </div>

          {/* Client data */}
          <div style={{ marginBottom: '6mm' }}>
            <div style={{ fontWeight: 600, fontSize: '11px', color: '#374151', marginBottom: '4px', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px' }}>
              Datos del cliente
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', fontSize: '10.5px' }}>
              <div><strong>Nombre:</strong> {lead.cliente || '-'}</div>
              <div><strong>Teléfono:</strong> {lead.telefono || '-'}</div>
              <div><strong>Email:</strong> {lead.email || '-'}</div>
              <div><strong>Localidad:</strong> {lead.localidad || '-'} {lead.provincia ? `(${lead.provincia})` : ''}</div>
            </div>
          </div>

          {/* Vehicle data */}
          <div style={{ marginBottom: '6mm' }}>
            <div style={{ fontWeight: 600, fontSize: '11px', color: '#374151', marginBottom: '4px', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px' }}>
              Datos del vehículo
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px', fontSize: '10.5px' }}>
              <div><strong>Modelo:</strong> {lead.vehiculo || '-'}</div>
              <div><strong>Talla:</strong> {lead.talla || '-'}</div>
              <div><strong>Tipo:</strong> {lead.viaj_dorm || '-'}</div>
              <div><strong>Kilometraje:</strong> {mileage || '-'} km</div>
              <div><strong>Combustible:</strong> {fuelLevel}</div>
            </div>
          </div>

          {/* Observations */}
          <div style={{ marginBottom: '6mm' }}>
            <div style={{ fontWeight: 600, fontSize: '11px', color: '#374151', marginBottom: '4px', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px' }}>
              Observaciones del estado
            </div>
            <div style={{ padding: '8px', background: '#f9fafb', borderRadius: '4px', fontSize: '10.5px', minHeight: '40px', whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb' }}>
              {observations || '(Sin observaciones)'}
            </div>
          </div>

          {/* Photos */}
          {photos.length > 0 && (
            <div style={{ marginBottom: '6mm' }}>
              <div style={{ fontWeight: 600, fontSize: '11px', color: '#374151', marginBottom: '4px', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', paddingBottom: '2px' }}>
                Fotos del estado ({photos.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {photos.map((p, i) => (
                  <img key={i} src={p.preview} alt={`Foto ${i + 1}`} style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                ))}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16mm' }}>
            <div style={{ textAlign: 'center' }}>
              {clientSignature ? (
                <img src={clientSignature} alt="Firma cliente" style={{ width: '200px', height: '80px', objectFit: 'contain' }} />
              ) : (
                <div style={{ width: '200px', height: '80px' }} />
              )}
              <div style={{ width: '200px', borderTop: '1px solid #333', paddingTop: '4px', fontSize: '10px', color: '#666' }}>
                Firma del cliente
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '200px', height: '80px' }} />
              <div style={{ width: '200px', borderTop: '1px solid #333', paddingTop: '4px', fontSize: '10px', color: '#666' }}>
                Firma del taller
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '4px', marginTop: '10mm', fontSize: '8px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
            <span>{company.name}{company.nif ? ` · NIF ${company.nif}` : ''}</span>
            <span>Generado el {new Date().toLocaleDateString('es-ES')}</span>
          </div>
        </div>
      </div>
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
