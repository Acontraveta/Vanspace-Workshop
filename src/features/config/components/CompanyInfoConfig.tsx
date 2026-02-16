import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { ConfigService } from '../services/configService'
import { CompanyInfo } from '../types/config.types'
import toast from 'react-hot-toast'

export default function CompanyInfoConfig() {
  const [info, setInfo] = useState<CompanyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Set<string>>(new Set())
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  useEffect(() => {
    loadInfo()
  }, [])

  const loadInfo = async () => {
    try {
      const data = await ConfigService.getCompanyInfo()
      setInfo(data)
      
      const initialValues: Record<string, string> = {}
      data.forEach(item => {
        initialValues[item.campo] = item.valor
      })
      setEditValues(initialValues)
    } catch (error) {
      toast.error('Error cargando datos de empresa')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (campo: string) => {
    setEditing(prev => new Set(prev).add(campo))
  }

  const handleSave = async (campo: string) => {
    try {
      await ConfigService.updateCompanyInfo(campo, editValues[campo])
      toast.success('Información actualizada')
      setEditing(prev => {
        const newSet = new Set(prev)
        newSet.delete(campo)
        return newSet
      })
      loadInfo()
    } catch (error) {
      toast.error('Error guardando cambios')
    }
  }

  const handleCancel = (campo: string, originalValue: string) => {
    setEditValues(prev => ({ ...prev, [campo]: originalValue }))
    setEditing(prev => {
      const newSet = new Set(prev)
      newSet.delete(campo)
      return newSet
    })
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Datos de la Empresa</h2>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {info.map((item) => {
              const isEditing = editing.has(item.campo)

              return (
                <div key={item.campo} className="flex items-start gap-4 pb-4 border-b last:border-b-0">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {item.campo}
                    </label>
                    {item.campo === 'DIRECCION' || item.campo === 'DATOS_BANCARIOS' ? (
                      <textarea
                        value={editValues[item.campo] || item.valor}
                        onChange={(e) => setEditValues(prev => ({ ...prev, [item.campo]: e.target.value }))}
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 border rounded resize-none ${!isEditing ? 'bg-gray-100' : ''}`}
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={editValues[item.campo] || item.valor}
                        onChange={(e) => setEditValues(prev => ({ ...prev, [item.campo]: e.target.value }))}
                        disabled={!isEditing}
                        className={!isEditing ? 'bg-gray-100' : ''}
                      />
                    )}
                  </div>

                  <div className="flex gap-2 pt-6">
                    {isEditing ? (
                      <>
                        <Button
                          onClick={() => handleSave(item.campo)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          💾
                        </Button>
                        <Button
                          onClick={() => handleCancel(item.campo, item.valor)}
                          size="sm"
                          variant="outline"
                        >
                          ❌
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleEdit(item.campo)}
                        size="sm"
                      >
                        ✏️
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}