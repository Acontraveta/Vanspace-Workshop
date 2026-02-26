import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { CatalogProduct } from '../types/quote.types'
import { CatalogService } from '../services/catalogService'
import { CONFIG } from '@/shared/utils/constants'
import { fmtEur, fmtHours } from '@/shared/utils/formatters'
import toast from 'react-hot-toast'

interface ManualProductModalProps {
  onAdd: (product: CatalogProduct) => void
  onCancel: () => void
}

export default function ManualProductModal({ onAdd, onCancel }: ManualProductModalProps) {
  const [formData, setFormData] = useState({
    nombre: '',
    sku: `MANUAL-${Date.now()}`,
    familia: '',
    categoria: '',
    precioCompra: 0,
    tiempoTotalMin: 0,
    requiereDiseno: false,
    tipoDiseno: '' as string,  // comma-separated department keys: furniture,exterior,interior
    instruccionesDiseno: '',
    buscarEnStock: true, // Por defecto sí buscar en stock
    crearOrdenCompra: false, // Si no hay stock, crear orden
    generarTarea: true, // Generar tarea de trabajo
    instruccionesTarea: '', // Instrucciones específicas de la tarea
    guardarEnCatalogo: false, // Guardar permanentemente en el catálogo + Excel
    precioVenta: 0, // Precio de venta (solo si se guarda en catálogo)
    proveedor: '', // Proveedor
    diasEntrega: 0, // Días de entrega del proveedor
  })

  const [materiales, setMateriales] = useState<Array<{ nombre: string; cantidad: number; unidad: string }>>([])
  const [consumibles, setConsumibles] = useState<Array<{ nombre: string; cantidad: number; unidad: string }>>([])

  const addMaterial = () => {
    setMateriales([...materiales, { nombre: '', cantidad: 1, unidad: 'ud' }])
  }

  const updateMaterial = (index: number, field: string, value: any) => {
    const updated = [...materiales]
    updated[index] = { ...updated[index], [field]: value }
    setMateriales(updated)
  }

  const removeMaterial = (index: number) => {
    setMateriales(materiales.filter((_, i) => i !== index))
  }

  const addConsumible = () => {
    setConsumibles([...consumibles, { nombre: '', cantidad: 1, unidad: 'ud' }])
  }

  const updateConsumible = (index: number, field: string, value: any) => {
    const updated = [...consumibles]
    updated[index] = { ...updated[index], [field]: value }
    setConsumibles(updated)
  }

  const removeConsumible = (index: number) => {
    setConsumibles(consumibles.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!formData.nombre) {
      toast.error('El nombre es obligatorio')
      return
    }

    // Construir objeto catalogData en formato estándar del catálogo
    const catalogData: any = {
      // Materiales en formato MATERIAL_1, MATERIAL_2...
      ...materiales.reduce((acc, mat, idx) => {
        const num = idx + 1
        if (mat.nombre) {
          acc[`MATERIAL_${num}`] = mat.nombre
          acc[`MATERIAL_${num}_CANT`] = mat.cantidad
          acc[`MATERIAL_${num}_UNIDAD`] = mat.unidad
        }
        return acc
      }, {} as any),
      
      // Consumibles en formato CONSUMIBLE_1, CONSUMIBLE_2...
      ...consumibles.reduce((acc, cons, idx) => {
        const num = idx + 1
        if (cons.nombre) {
          acc[`CONSUMIBLE_${num}`] = cons.nombre
          acc[`CONSUMIBLE_${num}_CANT`] = cons.cantidad
          acc[`CONSUMIBLE_${num}_UNIDAD`] = cons.unidad
        }
        return acc
      }, {} as any),
      
      // Diseño
      REQUIERE_DISEÑO: formData.requiereDiseno ? 'SÍ' : 'NO',
      TIPO_DISEÑO: formData.requiereDiseno ? formData.tipoDiseno : undefined,
      INSTRUCCIONES_DISEÑO: formData.requiereDiseno ? formData.instruccionesDiseno : undefined,
    }

    // Si debe generar tarea, crear TAREA_1
    if (formData.generarTarea) {
      catalogData.TAREA_1_NOMBRE = formData.nombre
      catalogData.TAREA_1_DURACION = formData.tiempoTotalMin / 60 // Convertir a horas
      catalogData.TAREA_1_REQUIERE_MATERIAL = (formData.buscarEnStock || formData.crearOrdenCompra) && materiales.length > 0 ? 'SÍ' : 'NO'
      catalogData.TAREA_1_REQUIERE_DISEÑO = formData.requiereDiseno ? 'SÍ' : 'NO'
      
      // Si hay instrucciones de tarea específicas, usarlas; si no, usar las de diseño
      if (formData.instruccionesTarea) {
        catalogData.INSTRUCCIONES_DISEÑO = formData.instruccionesTarea
      }
    }

    const product: CatalogProduct = {
      SKU: formData.sku,
      NOMBRE: formData.nombre,
      FAMILIA: formData.familia || 'personalizado',
      CATEGORIA: formData.categoria || 'sin categoría',
      PRECIO_COMPRA: formData.precioCompra ? Math.round(formData.precioCompra * (1 + CONFIG.IVA / 100) * 100) / 100 : 0,
      'PRECIO DE VENTA': formData.precioVenta || undefined,
      PROVEEDOR: formData.proveedor || undefined,
      DIAS_ENTREGA_PROVEEDOR: formData.diasEntrega || undefined,
      TIEMPO_TOTAL_MIN: formData.tiempoTotalMin,
      ...catalogData // Spread del catalogData construido arriba
    }

    // Guardar en catálogo permanente si el usuario lo pidió
    if (formData.guardarEnCatalogo) {
      CatalogService.addProduct(product)
        .then(() => toast.success('Producto guardado en el catálogo y Excel'))
        .catch((err: any) => toast.error('Error guardando en catálogo: ' + err.message))
    }

    onAdd(product)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">✏️</span>
            Añadir Producto Manual
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Datos básicos */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <Input
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Instalación eléctrica personalizada"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">SKU</label>
                <Input
                  value={formData.sku}
                  onChange={e => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Auto-generado"
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Familia</label>
                <Input
                  value={formData.familia}
                  onChange={e => setFormData({ ...formData, familia: e.target.value })}
                  placeholder="Ej: electricidad, fontanería..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoría</label>
                <Input
                  value={formData.categoria}
                  onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ej: instalación, reparación..."
                />
              </div>
            </div>

            {/* Precio y tiempo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Precio Compra (sin IVA) €</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.precioCompra}
                  onChange={e => setFormData({ ...formData, precioCompra: parseFloat(e.target.value) || 0 })}
                />
                {formData.precioCompra > 0 && (
                  <p className="text-xs text-emerald-600 mt-1 font-medium">
                    Con IVA ({CONFIG.IVA}%): {fmtEur(formData.precioCompra * (1 + CONFIG.IVA / 100))}€
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Precio Venta (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.precioVenta}
                  onChange={e => setFormData({ ...formData, precioVenta: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tiempo Total (min)</label>
                <Input
                  type="number"
                  value={formData.tiempoTotalMin}
                  onChange={e => setFormData({ ...formData, tiempoTotalMin: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  = {fmtHours(formData.tiempoTotalMin / 60)} horas
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Proveedor</label>
                <Input
                  value={formData.proveedor}
                  onChange={e => setFormData({ ...formData, proveedor: e.target.value })}
                  placeholder="Nombre proveedor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Días entrega</label>
                <Input
                  type="number"
                  value={formData.diasEntrega}
                  onChange={e => setFormData({ ...formData, diasEntrega: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Materiales */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">🔩 Materiales</h3>
                <Button size="sm" onClick={addMaterial} variant="outline">
                  ➕ Añadir Material
                </Button>
              </div>
              {materiales.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Sin materiales. Haz clic en "Añadir Material" para agregar.
                </p>
              ) : (
                <div className="space-y-2">
                  {materiales.map((mat, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <Input
                        placeholder="Nombre del material"
                        value={mat.nombre}
                        onChange={e => updateMaterial(idx, 'nombre', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Cant"
                        value={mat.cantidad}
                        onChange={e => updateMaterial(idx, 'cantidad', parseFloat(e.target.value) || 1)}
                        className="w-20"
                      />
                      <select
                        value={mat.unidad}
                        onChange={e => updateMaterial(idx, 'unidad', e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="ud">ud</option>
                        <option value="m">m</option>
                        <option value="m²">m²</option>
                        <option value="kg">kg</option>
                        <option value="l">l</option>
                      </select>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeMaterial(idx)}
                        className="px-2"
                      >
                        🗑️
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Consumibles */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">🧰 Consumibles</h3>
                <Button size="sm" onClick={addConsumible} variant="outline">
                  ➕ Añadir Consumible
                </Button>
              </div>
              {consumibles.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Sin consumibles. Haz clic en "Añadir Consumible" para agregar.
                </p>
              ) : (
                <div className="space-y-2">
                  {consumibles.map((cons, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <Input
                        placeholder="Nombre del consumible"
                        value={cons.nombre}
                        onChange={e => updateConsumible(idx, 'nombre', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Cant"
                        value={cons.cantidad}
                        onChange={e => updateConsumible(idx, 'cantidad', parseFloat(e.target.value) || 1)}
                        className="w-20"
                      />
                      <select
                        value={cons.unidad}
                        onChange={e => updateConsumible(idx, 'unidad', e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="ud">ud</option>
                        <option value="m">m</option>
                        <option value="kg">kg</option>
                        <option value="l">l</option>
                      </select>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeConsumible(idx)}
                        className="px-2"
                      >
                        🗑️
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Diseño */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="requiereDiseno"
                  checked={formData.requiereDiseno}
                  onChange={e => setFormData({ ...formData, requiereDiseno: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="requiereDiseno" className="font-semibold cursor-pointer">
                  📐 Requiere Diseño
                </label>
              </div>

              {formData.requiereDiseno && (
                <div className="space-y-3 ml-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">Departamentos de diseño</label>
                    <p className="text-xs text-gray-500 mb-2">Selecciona a qué departamentos debe ir este producto</p>
                    <div className="space-y-2">
                      {[
                        { key: 'furniture', icon: '🪑', label: 'Muebles', desc: 'Planos, despiece y optimización de corte' },
                        { key: 'exterior', icon: '🚐', label: 'Exterior', desc: 'Ventanas, claraboyas y elementos exteriores' },
                        { key: 'interior', icon: '🏠', label: 'Interior', desc: 'Distribución en plano interior de la furgoneta' },
                      ].map(dept => {
                        const selected = formData.tipoDiseno.split(',').filter(Boolean)
                        const isChecked = selected.includes(dept.key)
                        return (
                          <label key={dept.key} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                            isChecked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}>
                            <input type="checkbox" checked={isChecked} className="w-4 h-4 accent-emerald-600"
                              onChange={() => {
                                const newSelected = isChecked
                                  ? selected.filter(k => k !== dept.key)
                                  : [...selected, dept.key]
                                setFormData({ ...formData, tipoDiseno: newSelected.join(',') })
                              }} />
                            <span className="text-lg">{dept.icon}</span>
                            <div>
                              <div className="text-sm font-medium">{dept.label}</div>
                              <div className="text-xs text-gray-500">{dept.desc}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Instrucciones de Diseño</label>
                    <textarea
                      value={formData.instruccionesDiseno}
                      onChange={e => setFormData({ ...formData, instruccionesDiseno: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Describe las especificaciones del diseño..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Automatización: Stock y Órdenes */}
            <div className="border-t pt-4 bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-green-800">⚙️ Automatización</h3>
              
              <div className="space-y-3">
                {/* Buscar en stock */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="buscarEnStock"
                    checked={formData.buscarEnStock}
                    onChange={e => setFormData({ ...formData, buscarEnStock: e.target.checked })}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="buscarEnStock" className="font-medium cursor-pointer text-sm">
                      📦 Buscar materiales en stock
                    </label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      El sistema verificará disponibilidad en almacén antes de crear órdenes de compra
                    </p>
                  </div>
                </div>

                {/* Crear orden de compra */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="crearOrdenCompra"
                    checked={formData.crearOrdenCompra}
                    onChange={e => setFormData({ ...formData, crearOrdenCompra: e.target.checked })}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="crearOrdenCompra" className="font-medium cursor-pointer text-sm">
                      🛒 Crear orden de compra automática
                    </label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Si no hay stock suficiente, se generará automáticamente una orden de compra
                    </p>
                  </div>
                </div>

                {/* Generar tarea */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="generarTarea"
                    checked={formData.generarTarea}
                    onChange={e => setFormData({ ...formData, generarTarea: e.target.checked })}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="generarTarea" className="font-medium cursor-pointer text-sm">
                      ⚙️ Generar tarea de trabajo
                    </label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Se creará una tarea en el sistema de producción con las instrucciones especificadas
                    </p>
                  </div>
                </div>

                {/* Instrucciones de la tarea */}
                {formData.generarTarea && (
                  <div className="ml-6 mt-2">
                    <label className="block text-sm font-medium mb-1">Instrucciones de Trabajo</label>
                    <textarea
                      value={formData.instruccionesTarea}
                      onChange={e => setFormData({ ...formData, instruccionesTarea: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="Describe cómo realizar el trabajo, pasos específicos, precauciones..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Guardar en catálogo permanente */}
            <div className="border-t pt-4 bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="guardarEnCatalogo"
                  checked={formData.guardarEnCatalogo}
                  onChange={e => setFormData({ ...formData, guardarEnCatalogo: e.target.checked })}
                  className="w-4 h-4 mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="guardarEnCatalogo" className="font-medium cursor-pointer text-sm text-blue-800">
                    📋 Guardar en catálogo permanente
                  </label>
                  <p className="text-xs text-blue-600 mt-0.5">
                    El producto quedará registrado en el catálogo de la app y en el Excel, disponible para futuros presupuestos
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <div className="border-t p-4 bg-gray-50 flex gap-3">
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1 bg-purple-600 hover:bg-purple-700">
            ✅ Añadir Producto
          </Button>
        </div>
      </Card>
    </div>
  )
}