import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { ROLE_DESCRIPTIONS } from '../types/config.types'
import { ConfigService } from '../services/configService'
import { ProductionEmployee } from '../types/config.types'
import toast from 'react-hot-toast'

// Dummy permissions for demonstration; replace with real fetch if needed
const allPermissions: { permission_key: string; permission_name: string; category: string }[] = [];
const setAllPermissions = () => {};

export default function EmployeesConfig() {
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ProductionEmployee>>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<Partial<ProductionEmployee>>({
    id: '',
    nombre: '',
    rol: '',
    activo: true,
    password_hash: '',
  })

  // (Removed duplicate function declarations)
  useEffect(() => {
    loadEmployees()
    // Uncomment and implement if permissions are needed
    // loadPermissions()
  }, [])

  const loadEmployees = async () => {
    try {
      const data = await ConfigService.getEmployees()
      setEmployees(data)
    } catch (error) {
      toast.error('Error cargando empleados')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (employee: ProductionEmployee) => {
    setEditing(employee.id)
      setEditForm({
        ...employee,
        password_hash: '' // No prellenar la contraseña por seguridad
      })
  }

  const handleSave = async () => {
    if (!editForm.nombre || !editForm.rol || !editForm.tarifa_hora_eur) {
      toast.error('Completa todos los campos obligatorios')
      return
    }
    // Validar email
    if (!editForm.email || !editForm.email.includes('@')) {
      toast.error('Introduce un email válido')
      return
    }
    // Validar contraseña solo si es nuevo empleado
    if (!editing && (!editForm.password_hash || editForm.password_hash.length < 6)) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    try {
      // Construir permisos finales
      // ...aquí podrías agregar lógica de permisos si aplica...
      const employeeData = {
        ...editForm,
        tarifa_hora_eur: parseFloat(editForm.tarifa_hora_eur?.toString() || '0'),
        horas_semanales: editForm.horas_semanales ? parseFloat(editForm.horas_semanales.toString()) : null,
        activo: editForm.activo !== false,
      }
      // Al editar, solo incluir password si se proporcionó una nueva
      if (editForm.password_hash && editForm.password_hash.trim() !== '') {
        await ConfigService.updateEmployee(editing, {
          ...employeeData,
          password_hash: editForm.password_hash
        })
      } else {
        await ConfigService.updateEmployee(editing, employeeData)
      }
      toast.success('Empleado actualizado')
      setEditing(null)
      loadEmployees()
    } catch (error) {
      toast.error('Error guardando cambios')
    }
  }

  const handleCreate = async () => {
    if (!createForm.id || !createForm.nombre || !createForm.rol) {
      toast.error('ID, Nombre y Rol son obligatorios')
      return
    }

    try {
      await ConfigService.createEmployee(createForm as ProductionEmployee)
      toast.success('Empleado creado exitosamente')
      setShowCreateModal(false)
      setCreateForm({
        id: '',
        nombre: '',
        rol: '',
        activo: true,
      })
      loadEmployees()
    } catch (error: any) {
      toast.error('Error creando empleado: ' + error.message)
    }
  }

  const handleToggleActive = async (id: string, activo: boolean) => {
    try {
      await ConfigService.updateEmployee(id, { activo: !activo })
      toast.success(activo ? 'Empleado desactivado' : 'Empleado activado')
      loadEmployees()
    } catch (error) {
      toast.error('Error cambiando estado')
    }
  }

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar al empleado "${nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await ConfigService.deleteEmployee(id)
      toast.success('Empleado eliminado')
      loadEmployees()
    } catch (error: any) {
      toast.error('Error eliminando empleado: ' + error.message)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Empleados de Producción</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          ➕ Nuevo Empleado
        </Button>
      </div>

      {/* Modal de Creación */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>➕ Nuevo Empleado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">ID *</label>
                    <Input
                      value={createForm.id}
                      onChange={(e) => setCreateForm({ ...createForm, id: e.target.value })}
                      placeholder="Ej: EMP-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre *</label>
                    <Input
                      value={createForm.nombre}
                      onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>

                  {/* Rol de usuario */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Rol de usuario</label>
                    <select
                      value={createForm.role || 'operario'}
                      onChange={e => {
                        const role = e.target.value as ProductionEmployee['role']
                        setCreateForm({ ...createForm, role })
                        // Auto-llenar permisos según el rol
                        // setSelectedPermissions(ROLE_PERMISSIONS[role] || [])
                      }}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="operario">👷 Operario - Solo sus tareas</option>
                      <option value="compras">📦 Compras - Pedidos, stock y CRM</option>
                      <option value="encargado_taller">🏭 Encargado de Taller - Gestión de producción</option>
                      <option value="encargado">👔 Encargado - Visualiza todo, edita con permiso</option>
                      <option value="admin">⚡ Administrador - Acceso total</option>
                    </select>
                    {createForm.role && ROLE_DESCRIPTIONS && ROLE_DESCRIPTIONS[createForm.role] && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                        <p className="text-blue-800">
                          {ROLE_DESCRIPTIONS[createForm.role].description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Especialidad Principal</label>
                    <Input
                      value={createForm.especialidad_principal || ''}
                      onChange={(e) => setCreateForm({ ...createForm, especialidad_principal: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Especialidad Secundaria</label>
                    <Input
                      value={createForm.especialidad_secundaria || ''}
                      onChange={(e) => setCreateForm({ ...createForm, especialidad_secundaria: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tarifa/Hora (€)</label>
                    <Input
                      type="number"
                      value={createForm.tarifa_hora_eur || ''}
                      onChange={(e) => setCreateForm({ ...createForm, tarifa_hora_eur: parseFloat(e.target.value) || undefined })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Horas/Semana</label>
                    <Input
                      type="number"
                      value={createForm.horas_semanales || ''}
                      onChange={(e) => setCreateForm({ ...createForm, horas_semanales: parseInt(e.target.value) || undefined })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <Input
                      type="email"
                      value={createForm.email || ''}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Contraseña *</label>
                    <Input
                      type="password"
                      value={createForm.password_hash || ''}
                      onChange={(e) => setCreateForm({ ...createForm, password_hash: e.target.value })}
                      placeholder="Contraseña del empleado"
                      required
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      El empleado usará esta contraseña para acceder
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Teléfono</label>
                    <Input
                      value={createForm.telefono || ''}
                      onChange={(e) => setCreateForm({ ...createForm, telefono: e.target.value })}
                    />
                  </div>
                  {/* Permisos personalizados: desplegable múltiple */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      Permisos personalizados
                      <span className="text-xs text-gray-500 ml-2">
                        (Los permisos del rol se aplican automáticamente)
                      </span>
                    </label>
                    <select
                      multiple
                      value={createForm.permissions ? Object.keys(createForm.permissions).filter(p => createForm.permissions[p]) : []}
                      onChange={e => {
                        const selected = Array.from(e.target.selectedOptions).map(opt => opt.value)
                        const perms: Record<string, boolean> = {}
                        allPermissions.forEach(p => {
                          perms[p.permission_key] = selected.includes(p.permission_key)
                        })
                        setCreateForm({ ...createForm, permissions: perms })
                      }}
                      className="w-full border rounded p-2 h-48 bg-gray-50"
                    >
                      {allPermissions.map(perm => (
                        <option key={perm.permission_key} value={perm.permission_key}>
                          {perm.permission_name} ({perm.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={createForm.activo}
                      onChange={(e) => setCreateForm({ ...createForm, activo: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label className="text-sm font-medium">Activo</label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreate} className="bg-green-600 hover:bg-green-700 flex-1">
                    💾 Crear Empleado
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map((emp) => (
          <Card key={emp.id} className={!emp.activo ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{emp.nombre}</CardTitle>
                <Badge variant={emp.activo ? 'success' : 'secondary'}>
                  {emp.activo ? '✅ Activo' : '❌ Inactivo'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{emp.rol}</p>
            </CardHeader>

            <CardContent>
              {editing === emp.id ? (
                // MODO EDICIÓN
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre</label>
                    <Input
                      value={editForm.nombre}
                      onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Rol de usuario</label>
                    <select
                      value={editForm.role || 'operario'}
                      onChange={e => setEditForm({ ...editForm, role: e.target.value as ProductionEmployee['role'] })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="operario">👷 Operario - Solo sus tareas</option>
                      <option value="compras">📦 Compras - Pedidos, stock y CRM</option>
                      <option value="encargado_taller">🏭 Encargado de Taller - Gestión de producción</option>
                      <option value="encargado">👔 Encargado - Visualiza todo, edita con permiso</option>
                      <option value="admin">⚡ Administrador - Acceso total</option>
                    </select>
                    {editForm.role && ROLE_DESCRIPTIONS && ROLE_DESCRIPTIONS[editForm.role] && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                        <p className="text-blue-800">
                          {ROLE_DESCRIPTIONS[editForm.role].description}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Especialidad Principal</label>
                    <Input
                      value={editForm.especialidad_principal}
                      onChange={(e) => setEditForm({ ...editForm, especialidad_principal: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Especialidad Secundaria</label>
                    <Input
                      value={editForm.especialidad_secundaria}
                      onChange={(e) => setEditForm({ ...editForm, especialidad_secundaria: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Tarifa/Hora (€)</label>
                      <Input
                        type="number"
                        value={editForm.tarifa_hora_eur || ''}
                        onChange={(e) => setEditForm({ ...editForm, tarifa_hora_eur: parseFloat(e.target.value) })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Horas/Semana</label>
                      <Input
                        type="number"
                        value={editForm.horas_semanales || ''}
                        onChange={(e) => setEditForm({ ...editForm, horas_semanales: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Teléfono</label>
                    <Input
                      value={editForm.telefono}
                      onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700" size="sm">
                      💾 Guardar
                    </Button>
                    <Button onClick={() => setEditing(null)} variant="outline" size="sm">
                      ❌ Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                // MODO VISTA
                <div className="space-y-2">
                  {emp.especialidad_principal && (
                    <div>
                      <p className="text-xs text-gray-600">Especialidad Principal</p>
                      <p className="text-sm font-medium">{emp.especialidad_principal}</p>
                    </div>
                  )}

                  {emp.especialidad_secundaria && (
                    <div>
                      <p className="text-xs text-gray-600">Especialidad Secundaria</p>
                      <p className="text-sm">{emp.especialidad_secundaria}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {emp.tarifa_hora_eur && (
                      <div>
                        <p className="text-xs text-gray-600">Tarifa/Hora</p>
                        <p className="font-bold">{emp.tarifa_hora_eur}€</p>
                      </div>
                    )}
                    {emp.horas_semanales && (
                      <div>
                        <p className="text-xs text-gray-600">Horas/Semana</p>
                        <p className="font-bold">{emp.horas_semanales}h</p>
                      </div>
                    )}
                  </div>

                  {(emp.email || emp.telefono) && (
                    <div className="pt-2 border-t">
                      {emp.email && <p className="text-xs">📧 {emp.email}</p>}
                      {emp.telefono && <p className="text-xs">📱 {emp.telefono}</p>}
                    </div>
                  )}

                  <div className="flex gap-2 pt-3">
                    <Button onClick={() => handleEdit(emp)} size="sm">
                      ✏️ Editar
                    </Button>
                    <Button
                      onClick={() => handleToggleActive(emp.id, emp.activo)}
                      variant="outline"
                      size="sm"
                    >
                      {emp.activo ? '🔴 Desactivar' : '🟢 Activar'}
                    </Button>
                    <Button
                      onClick={() => handleDelete(emp.id, emp.nombre)}
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
    </div>
  )
}