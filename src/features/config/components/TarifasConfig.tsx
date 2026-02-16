import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { ConfigService } from '../services/configService'
import { Tarifa } from '../types/config.types'
import toast from 'react-hot-toast'

export default function TarifasConfig() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Tarifa>>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<Partial<Tarifa>>({
    id: '',
    nombre_tarifa: '',
    tarifa_hora_eur: 0,
    margen_materiales_pct: 0,
    urgencia: 'MEDIA',
    activa: true,
  })

  useEffect(() => {
    loadTarifas()
  }, [])

  const loadTarifas = async () => {
    try {
      const data = await ConfigService.getTarifas()
      setTarifas(data)
    } catch (error) {
      toast.error('Error cargando tarifas')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (tarifa: Tarifa) => {
    setEditing(tarifa.id)
    setEditForm(tarifa)
  }

  const handleSave = async () => {
    if (!editing) return

    try {
      await ConfigService.updateTarifa(editing, editForm)
      toast.success('Tarifa actualizada')
      setEditing(null)
      loadTarifas()
    } catch (error) {
      toast.error('Error guardando cambios')
    }
  }

  const handleCreate = async () => {
    if (!createForm.id || !createForm.nombre_tarifa) {
      toast.error('ID y Nombre son obligatorios')
      return
    }

    try {
      await ConfigService.createTarifa(createForm as Tarifa)
      toast.success('Tarifa creada exitosamente')
      setShowCreateModal(false)
      setCreateForm({
        id: '',
        nombre_tarifa: '',
        tarifa_hora_eur: 0,
        margen_materiales_pct: 0,
        urgencia: 'MEDIA',
        activa: true,
      })
      loadTarifas()
    } catch (error: any) {
      toast.error('Error creando tarifa: ' + error.message)
    }
  }

  const handleToggleActive = async (id: string, activa: boolean) => {
    try {
      await ConfigService.updateTarifa(id, { activa: !activa })
      toast.success(activa ? 'Tarifa desactivada' : 'Tarifa activada')
      loadTarifas()
    } catch (error) {
      toast.error('Error cambiando estado')
    }
  }

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar la tarifa "${nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await ConfigService.deleteTarifa(id)
      toast.success('Tarifa eliminada')
      loadTarifas()
    } catch (error: any) {
      toast.error('Error eliminando tarifa: ' + error.message)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Tarifas</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          ➕ Nueva Tarifa
        </Button>
      </div>

      {/* Modal de Creación */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>➕ Nueva Tarifa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">ID *</label>
                    <Input
                      value={createForm.id}
                      onChange={(e) => setCreateForm({ ...createForm, id: e.target.value })}
                      placeholder="Ej: CAMPER"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre *</label>
                    <Input
                      value={createForm.nombre_tarifa}
                      onChange={(e) => setCreateForm({ ...createForm, nombre_tarifa: e.target.value })}
                      placeholder="Ej: Camperización"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tarifa Hora (€) *</label>
                    <Input
                      type="number"
                      value={createForm.tarifa_hora_eur}
                      onChange={(e) => setCreateForm({ ...createForm, tarifa_hora_eur: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Margen Materiales (%) *</label>
                    <Input
                      type="number"
                      value={createForm.margen_materiales_pct}
                      onChange={(e) => setCreateForm({ ...createForm, margen_materiales_pct: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Urgencia</label>
                    <select
                      value={createForm.urgencia}
                      onChange={(e) => setCreateForm({ ...createForm, urgencia: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="BAJA">BAJA</option>
                      <option value="MEDIA">MEDIA</option>
                      <option value="ALTA">ALTA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Días Trabajo/Semana</label>
                    <Input
                      type="number"
                      value={createForm.dias_trabajo_semana || ''}
                      onChange={(e) => setCreateForm({ ...createForm, dias_trabajo_semana: parseInt(e.target.value) || undefined })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Horas/Día</label>
                    <Input
                      type="number"
                      step="0.5"
                      value={createForm.horas_dia || ''}
                      onChange={(e) => setCreateForm({ ...createForm, horas_dia: parseFloat(e.target.value) || undefined })}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={createForm.activa}
                      onChange={(e) => setCreateForm({ ...createForm, activa: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label className="text-sm font-medium">Activa</label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700 flex-1">
                    💾 Crear Tarifa
                  </Button>
                  <Button onClick={() => setShowCreateModal(false)} variant="outline" className="flex-1">
                    ❌ Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tarifas.map((tarifa) => (
        <Card key={tarifa.id} className={!tarifa.activa ? 'opacity-60' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{tarifa.nombre_tarifa}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={tarifa.activa ? 'success' : 'secondary'}>
                  {tarifa.activa ? '✅ Activa' : '❌ Inactiva'}
                </Badge>
                {tarifa.urgencia && (
                  <Badge variant={
                    tarifa.urgencia === 'ALTA' ? 'destructive' :
                    tarifa.urgencia === 'MEDIA' ? 'warning' : 'secondary'
                  }>
                    {tarifa.urgencia}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {editing === tarifa.id ? (
              // MODO EDICIÓN
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">ID</label>
                    <Input
                      value={editForm.id}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre</label>
                    <Input
                      value={editForm.nombre_tarifa}
                      onChange={(e) => setEditForm({ ...editForm, nombre_tarifa: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tarifa Hora (€)</label>
                    <Input
                      type="number"
                      value={editForm.tarifa_hora_eur}
                      onChange={(e) => setEditForm({ ...editForm, tarifa_hora_eur: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Margen Materiales (%)</label>
                    <Input
                      type="number"
                      value={editForm.margen_materiales_pct}
                      onChange={(e) => setEditForm({ ...editForm, margen_materiales_pct: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Urgencia</label>
                    <select
                      value={editForm.urgencia}
                      onChange={(e) => setEditForm({ ...editForm, urgencia: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="BAJA">BAJA</option>
                      <option value="MEDIA">MEDIA</option>
                      <option value="ALTA">ALTA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Días Trabajo/Semana</label>
                    <Input
                      type="number"
                      value={editForm.dias_trabajo_semana || ''}
                      onChange={(e) => setEditForm({ ...editForm, dias_trabajo_semana: parseInt(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Horas/Día</label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editForm.horas_dia || ''}
                      onChange={(e) => setEditForm({ ...editForm, horas_dia: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                    💾 Guardar
                  </Button>
                  <Button onClick={() => setEditing(null)} variant="outline">
                    ❌ Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              // MODO VISTA
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Tarifa/Hora</p>
                    <p className="font-bold text-lg">{tarifa.tarifa_hora_eur}€</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Margen Materiales</p>
                    <p className="font-bold text-lg">{tarifa.margen_materiales_pct}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Días/Semana</p>
                    <p className="font-bold text-lg">{tarifa.dias_trabajo_semana || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Horas/Día</p>
                    <p className="font-bold text-lg">{tarifa.horas_dia || '-'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => handleEdit(tarifa)} size="sm">
                    ✏️ Editar
                  </Button>
                  <Button
                    onClick={() => handleToggleActive(tarifa.id, tarifa.activa)}
                    variant="outline"
                    size="sm"
                  >
                    {tarifa.activa ? '🔴 Desactivar' : '🟢 Activar'}
                  </Button>
                  <Button
                    onClick={() => handleDelete(tarifa.id, tarifa.nombre_tarifa)}
                    variant="destructive"
                    size="sm"
                  >
                    🗑️ Eliminar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}