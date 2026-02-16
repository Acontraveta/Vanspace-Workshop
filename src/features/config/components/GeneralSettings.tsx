import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { ConfigService } from '../services/configService'
import { ConfigSetting } from '../types/config.types'
import toast from 'react-hot-toast'

export default function GeneralSettings() {
  const [selectedCategory, setSelectedCategory] = useState('calendario')
  const [settings, setSettings] = useState<ConfigSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Set<string>>(new Set())
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const categories = [
    { id: 'calendario', label: '📅 Calendario', icon: '📅' },
    { id: 'compras', label: '🛒 Compras', icon: '🛒' },
    { id: 'produccion', label: '⚙️ Producción', icon: '⚙️' },
    { id: 'diseno', label: '📐 Diseño', icon: '📐' },
    { id: 'presupuestos', label: '💰 Presupuestos', icon: '💰' },
  ]

  useEffect(() => {
    loadSettings()
  }, [selectedCategory])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await ConfigService.getConfigByCategory(selectedCategory)
      setSettings(data)
      
      // Inicializar valores de edición
      const initialValues: Record<string, string> = {}
      data.forEach(setting => {
        initialValues[setting.key] = setting.value
      })
      setEditValues(initialValues)
    } catch (error) {
      toast.error('Error cargando configuración')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (key: string) => {
    setEditing(prev => new Set(prev).add(key))
  }

  const handleSave = async (key: string) => {
    try {
      await ConfigService.updateConfig(key, editValues[key])
      toast.success('Configuración actualizada')
      setEditing(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
      loadSettings()
    } catch (error) {
      toast.error('Error guardando cambios')
    }
  }

  const handleCancel = (key: string, originalValue: string) => {
    setEditValues(prev => ({ ...prev, [key]: originalValue }))
    setEditing(prev => {
      const newSet = new Set(prev)
      newSet.delete(key)
      return newSet
    })
  }

  const renderInput = (setting: ConfigSetting) => {
    const isEditing = editing.has(setting.key)
    const value = editValues[setting.key] || setting.value

    if (setting.data_type === 'boolean') {
      return (
        <select
          value={value}
          onChange={(e) => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
          disabled={!isEditing}
          className={`px-3 py-2 border rounded ${!isEditing ? 'bg-gray-100' : ''}`}
        >
          <option value="true">SÍ</option>
          <option value="false">NO</option>
        </select>
      )
    }

    if (setting.data_type === 'number') {
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
          disabled={!isEditing}
          className={!isEditing ? 'bg-gray-100' : ''}
        />
      )
    }

    return (
      <Input
        value={value}
        onChange={(e) => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
        disabled={!isEditing}
        className={!isEditing ? 'bg-gray-100' : ''}
      />
    )
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>
  }

  return (
    <div>
      {/* Category Tabs */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Settings List */}
      <div className="space-y-3">
        {settings.map((setting) => {
          const isEditing = editing.has(setting.key)
          const displayKey = setting.key.split('.')[1]?.replace(/_/g, ' ').toUpperCase() || setting.key

          return (
            <Card key={setting.key}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{displayKey}</h3>
                      {setting.unit && (
                        <span className="text-xs text-gray-500">({setting.unit})</span>
                      )}
                    </div>
                    {setting.description && (
                      <p className="text-sm text-gray-600 mb-3">{setting.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {renderInput(setting)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          onClick={() => handleSave(setting.key)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          💾
                        </Button>
                        <Button
                          onClick={() => handleCancel(setting.key, setting.value)}
                          size="sm"
                          variant="outline"
                        >
                          ❌
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleEdit(setting.key)}
                        size="sm"
                      >
                        ✏️ Editar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}