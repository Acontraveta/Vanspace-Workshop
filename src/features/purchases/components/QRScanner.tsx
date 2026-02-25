import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { StockItem } from '../types/purchase.types'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

interface QRScannerProps {
  stock: StockItem[]
  onRefresh: () => Promise<void>
}

export default function QRScanner({ stock, onRefresh }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('')
  const [foundItem, setFoundItem] = useState<StockItem | null>(null)
  const [assigningLocation, setAssigningLocation] = useState(false)
  const [newLocation, setNewLocation] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<Array<{ item: StockItem; time: Date }>>([])
  const [generatingQR, setGeneratingQR] = useState(false)
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [qrPreviewItem, setQrPreviewItem] = useState<StockItem | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = 'qr-reader-container'

  const processCode = useCallback((code: string) => {
    let referencia = ''
    try {
      const data = JSON.parse(code)
      if (data.type === 'warehouse_product' && data.referencia) {
        referencia = data.referencia
      }
    } catch {
      // Plain text — treat as referencia or product name
      referencia = code.trim()
    }

    if (!referencia) {
      toast.error('Código QR no reconocido')
      return
    }

    // Search by referencia first, then by name
    const item = stock.find(
      s =>
        s.REFERENCIA?.toLowerCase() === referencia.toLowerCase() ||
        s.ARTICULO?.toLowerCase().includes(referencia.toLowerCase())
    )

    if (item) {
      setFoundItem(item)
      setScanHistory(prev => [{ item, time: new Date() }, ...prev.slice(0, 9)])
      toast.success(`Producto encontrado: ${item.ARTICULO}`)
    } else {
      toast.error(`Producto no encontrado: ${referencia}`)
    }  }, [stock])

  // Ref always points to latest processCode (for scanner callback closure)
  const processCodeRef = useRef(processCode)
  useEffect(() => { processCodeRef.current = processCode }, [processCode])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    // IMPORTANT: set active FIRST so the container is visible in the DOM
    // html5-qrcode cannot render into a hidden/zero-size element
    setCameraActive(true)

    // Wait for React to render the visible container
    await new Promise(r => setTimeout(r, 150))

    try {

      const scanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: { useBarCodeDetectorIfSupported: false },
        verbose: false,
      })
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          disableFlip: true,
        },
        (decodedText) => {
          console.log('[QR] Decoded:', decodedText)
          processCodeRef.current(decodedText)
          stopCamera()
        },
        () => {
          // Ignore scan failure (scanning in progress)
        }
      )
    } catch (err: any) {
      console.error('Error starting camera:', err)
      const msg = err?.message || String(err)
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Permiso de cámara denegado. Permite el acceso en la configuración del navegador.')
      } else if (msg.includes('NotFoundError') || msg.includes('NotReadableError')) {
        setCameraError('No se encontró ninguna cámara disponible en el dispositivo.')
      } else {
        setCameraError(`Error al iniciar la cámara: ${msg}`)
      }
      setCameraActive(false)
    }
  }, [processCode])

  const stopCamera = useCallback(() => {
    const scanner = scannerRef.current
    if (scanner) {
      scanner.stop().then(() => {
        scanner.clear()
      }).catch(() => {})
      scannerRef.current = null
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const assignLocation = async () => {
    if (!foundItem || !newLocation) return

    // Update in Supabase
    const { error } = await supabase
      .from('stock_items')
      .update({ ubicacion: newLocation.trim() })
      .eq('referencia', foundItem.REFERENCIA)

    if (error) {
      toast.error('Error al asignar ubicación: ' + error.message)
      return
    }

    toast.success(`✅ ${foundItem.ARTICULO} → ubicación ${newLocation}`)
    setFoundItem(null)
    setNewLocation('')
    setAssigningLocation(false)
    onRefresh()
  }

  const generateQRForItem = async (item: StockItem) => {
    setGeneratingQR(true)
    try {
      const qrData = JSON.stringify({
        type: 'warehouse_product',
        referencia: item.REFERENCIA,
        nombre: item.ARTICULO,
      })
      const dataUrl = await QRCode.toDataURL(qrData, { width: 400, margin: 2 })
      setQrPreview(dataUrl)
      setQrPreviewItem(item)
    } catch {
      toast.error('Error generando QR')
    }
    setGeneratingQR(false)
  }

  const printLabel = (item: StockItem, qrDataUrl: string) => {
    const printWindow = window.open('', '', 'width=400,height=500')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Etiqueta ${item.REFERENCIA}</title>
          <style>
            @page { size: 62mm 40mm; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              width: 62mm; height: 40mm;
              display: flex; align-items: center;
              padding: 2mm;
            }
            .label {
              display: flex; gap: 2mm; width: 100%; align-items: center;
            }
            .qr { width: 30mm; height: 30mm; flex-shrink: 0; }
            .qr img { width: 100%; height: 100%; }
            .info { flex: 1; overflow: hidden; }
            .ref { font-size: 9pt; font-weight: bold; margin-bottom: 1mm; }
            .name { font-size: 7pt; line-height: 1.2; margin-bottom: 1mm; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
            .loc { font-size: 8pt; color: #555; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr"><img src="${qrDataUrl}" /></div>
            <div class="info">
              <div class="ref">${item.REFERENCIA}</div>
              <div class="name">${item.ARTICULO}</div>
              ${item.UBICACION ? `<div class="loc">📍 ${item.UBICACION}</div>` : ''}
              <div class="loc">${item.FAMILIA || ''}</div>
            </div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 300)
  }

  const printMultipleLabels = async (items: StockItem[]) => {
    const printWindow = window.open('', '', 'width=600,height=800')
    if (!printWindow) return

    toast.loading('Generando etiquetas...', { id: 'batch-qr' })

    // Generate QR for each item
    const qrPromises = items.map(async (item) => {
      const qrData = JSON.stringify({
        type: 'warehouse_product',
        referencia: item.REFERENCIA,
        nombre: item.ARTICULO,
      })
      const dataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 1 })
      return { item, dataUrl }
    })

    const results = await Promise.all(qrPromises)

    const labelsHtml = results.map(({ item, dataUrl }) => `
      <div class="label">
        <div class="qr"><img src="${dataUrl}" /></div>
        <div class="info">
          <div class="ref">${item.REFERENCIA}</div>
          <div class="name">${item.ARTICULO}</div>
          ${item.UBICACION ? `<div class="loc">📍 ${item.UBICACION}</div>` : ''}
        </div>
      </div>
    `).join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Etiquetas QR</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 5mm; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
            .label {
              border: 0.5px dashed #ccc;
              padding: 2mm;
              display: flex; gap: 2mm; align-items: center;
              page-break-inside: avoid;
            }
            .qr { width: 22mm; height: 22mm; flex-shrink: 0; }
            .qr img { width: 100%; height: 100%; }
            .info { flex: 1; overflow: hidden; }
            .ref { font-size: 8pt; font-weight: bold; margin-bottom: 0.5mm; }
            .name { font-size: 6pt; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
            .loc { font-size: 6pt; color: #555; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .label { border-color: #ddd; }
            }
          </style>
        </head>
        <body>
          <div class="grid">${labelsHtml}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    toast.dismiss('batch-qr')
    toast.success(`${results.length} etiquetas generadas`)
    setTimeout(() => printWindow.print(), 500)
  }

  return (
    <div className="space-y-4">
      {/* Camera Scanner */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>📷 Escáner QR</span>
            {!cameraActive ? (
              <Button size="sm" onClick={startCamera} className="bg-emerald-600 hover:bg-emerald-700">
                📸 Abrir cámara
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={stopCamera}>
                ✕ Cerrar cámara
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cameraError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ⚠️ {cameraError}
            </div>
          )}

          {/* Camera video container — NEVER hidden, just collapsed when inactive
              html5-qrcode needs a visible DOM element to mount the <video> into */}
          <div
            id={scannerContainerId}
            className={`rounded-lg overflow-hidden transition-all ${cameraActive ? 'border-2 border-emerald-400' : ''}`}
            style={{
              minHeight: cameraActive ? 280 : 0,
              height: cameraActive ? 'auto' : 0,
              overflow: 'hidden',
              opacity: cameraActive ? 1 : 0,
            }}
          />

          {!cameraActive && !cameraError && (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">📱</div>
              <p className="text-gray-600 text-sm">Pulsa "Abrir cámara" para escanear un código QR</p>
              <p className="text-xs text-gray-400 mt-1">Apunta al QR pegado en el producto</p>
            </div>
          )}

          {/* Manual input fallback */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">O introduce manualmente</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Referencia o código QR..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCode.trim()) {
                  processCode(manualCode.trim())
                  setManualCode('')
                }
              }}
            />
            <Button onClick={() => { processCode(manualCode.trim()); setManualCode('') }} disabled={!manualCode.trim()}>
              🔍
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Found Item */}
      {foundItem && (
        <Card className="border-2 border-emerald-400 bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-emerald-800 flex items-center justify-between">
              <span>✅ Producto Encontrado</span>
              <Button size="sm" variant="ghost" onClick={() => setFoundItem(null)} className="text-gray-500 h-7 w-7 p-0">✕</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-white rounded-lg p-3 border">
              <h3 className="font-bold text-sm mb-2">{foundItem.ARTICULO}</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <span className="text-gray-500">Referencia:</span>
                  <span className="font-medium ml-1">{foundItem.REFERENCIA}</span>
                </div>
                <div>
                  <span className="text-gray-500">Stock:</span>
                  <span className="font-semibold text-emerald-600 ml-1">{foundItem.CANTIDAD} {foundItem.UNIDAD}</span>
                </div>
                <div>
                  <span className="text-gray-500">Ubicación:</span>
                  <span className="font-medium ml-1">{foundItem.UBICACION || '❌ Sin ubicar'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Familia:</span>
                  <span className="font-medium ml-1">{foundItem.FAMILIA}</span>
                </div>
                {foundItem.PROVEEDOR && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Proveedor:</span>
                    <span className="font-medium ml-1">{foundItem.PROVEEDOR}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {!assigningLocation ? (
                <>
                  <Button
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => setAssigningLocation(true)}
                  >
                    📍 Asignar ubicación
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={generatingQR}
                    onClick={() => generateQRForItem(foundItem)}
                  >
                    🏷️ Generar etiqueta
                  </Button>
                </>
              ) : (
                <div className="w-full space-y-2">
                  <Input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ubicación (ej: A23, E1-3-2)"
                    className="font-mono"
                    onKeyDown={(e) => { if (e.key === 'Enter') assignLocation() }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={assignLocation}>
                      ✅ Confirmar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAssigningLocation(false); setNewLocation('') }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Preview / Print */}
      {qrPreview && qrPreviewItem && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-blue-800 flex items-center justify-between">
              <span>🏷️ Etiqueta QR</span>
              <Button size="sm" variant="ghost" onClick={() => { setQrPreview(null); setQrPreviewItem(null) }} className="h-7 w-7 p-0 text-gray-500">✕</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Label preview */}
            <div className="bg-white p-3 rounded-lg border flex items-center gap-3">
              <img src={qrPreview} alt="QR" className="w-24 h-24 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-sm">{qrPreviewItem.REFERENCIA}</div>
                <div className="text-xs text-gray-600 line-clamp-2">{qrPreviewItem.ARTICULO}</div>
                {qrPreviewItem.UBICACION && <div className="text-xs text-blue-600 mt-1">📍 {qrPreviewItem.UBICACION}</div>}
                <div className="text-xs text-gray-400">{qrPreviewItem.FAMILIA}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => printLabel(qrPreviewItem, qrPreview)}>
                🖨️ Imprimir etiqueta
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                const link = document.createElement('a')
                link.download = `qr-${qrPreviewItem.REFERENCIA}.png`
                link.href = qrPreview
                link.click()
                toast.success('QR descargado')
              }}>
                💾 Descargar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Print */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>🏷️ Imprimir etiquetas en lote</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">Genera e imprime etiquetas QR para los productos del stock.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const noLocation = stock.filter(s => !s.UBICACION || s.UBICACION.trim() === '')
              if (noLocation.length === 0) {
                toast('Todos los productos tienen ubicación asignada')
                return
              }
              printMultipleLabels(noLocation)
            }}>
              📍 Sin ubicar ({stock.filter(s => !s.UBICACION || s.UBICACION.trim() === '').length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              if (stock.length === 0) {
                toast('No hay productos en stock')
                return
              }
              if (stock.length > 100) {
                if (!confirm(`¿Generar ${stock.length} etiquetas? Puede tardar unos segundos.`)) return
              }
              printMultipleLabels(stock)
            }}>
              📦 Todo el stock ({stock.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>📋 Historial de escaneos</span>
              <Button size="sm" variant="ghost" onClick={() => setScanHistory([])} className="text-xs text-gray-400">
                Limpiar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {scanHistory.map((entry, idx) => (
                <div
                  key={idx}
                  className="py-2 flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1"
                  onClick={() => setFoundItem(entry.item)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{entry.item.ARTICULO}</div>
                    <div className="text-xs text-gray-500">{entry.item.REFERENCIA} · {entry.item.UBICACION || 'Sin ubicar'}</div>
                  </div>
                  <div className="text-xs text-gray-400 shrink-0 ml-2">
                    {entry.time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}