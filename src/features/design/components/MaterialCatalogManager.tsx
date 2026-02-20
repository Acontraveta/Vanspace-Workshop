import { useState, useEffect, useMemo } from 'react'
import { CatalogMaterial } from '../types/furniture.types'
import { MaterialCatalogService } from '../services/materialCatalogService'
import { MATERIAL_CATEGORIES } from '../constants/furniture.constants'
import toast from 'react-hot-toast'

type CategoryFilter = CatalogMaterial['category'] | 'all'

export function MaterialCatalogManager() {
  const [materials, setMaterials]    = useState<CatalogMaterial[]>([])
  const [loading, setLoading]        = useState(true)
  const [filter, setFilter]          = useState<CategoryFilter>('all')
  const [editing, setEditing]        = useState<CatalogMaterial | null>(null)
  const [showForm, setShowForm]      = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await MaterialCatalogService.getAll()
    setMaterials(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(
    () => filter === 'all' ? materials : materials.filter(m => m.category === filter),
    [materials, filter]
  )

  const handleSave = async (mat: CatalogMaterial) => {
    try {
      await MaterialCatalogService.save(mat)
      toast.success('Material guardado')
      setShowForm(false)
      setEditing(null)
      MaterialCatalogService.invalidateCache()
      await load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este material del catálogo?')) return
    try {
      await MaterialCatalogService.delete(id)
      toast.success('Material eliminado')
      MaterialCatalogService.invalidateCache()
      await load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const openNew = () => {
    setEditing({
      id: `mat-${Date.now()}`,
      name: '',
      thickness: 16,
      price_per_m2: 30,
      color_hex: '#b89b72',
      texture_label: '',
      category: 'melamina',
      in_stock: true,
    })
    setShowForm(true)
  }

  const openEdit = (m: CatalogMaterial) => {
    setEditing({ ...m })
    setShowForm(true)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shadow-sm">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">🪵 Catálogo de Materiales</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">{materials.length} materiales registrados</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
          + Nuevo Material
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Category filter sidebar */}
        <aside className="w-48 bg-white border-r border-slate-200 p-3 space-y-1 flex-shrink-0">
          <button onClick={() => setFilter('all')}
            className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
              filter === 'all' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-50'
            }`}>
            📋 Todos
          </button>
          {MATERIAL_CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setFilter(c.value as CategoryFilter)}
              className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                filter === c.value ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-50'
              }`}>
              {c.label}
            </button>
          ))}
        </aside>

        {/* Materials grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sin materiales en esta categoría</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(m => (
                <div key={m.id}
                  className="bg-white rounded-xl border border-slate-200 p-3 hover:shadow-md transition-all group">
                  <div className="flex items-start gap-3">
                    {/* Colour swatch */}
                    <div className="w-10 h-10 rounded-lg border border-slate-200 flex-shrink-0 shadow-inner"
                      style={{ backgroundColor: m.color_hex }} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-bold text-slate-800 truncate">{m.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-mono text-slate-400">{m.thickness}mm</span>
                        <span className="text-[9px] font-bold text-amber-600">{m.price_per_m2} €/m²</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          m.in_stock ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                        }`}>
                          {m.in_stock ? 'En stock' : 'Agotado'}
                        </span>
                        <span className="text-[8px] text-slate-400 uppercase">{m.texture_label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(m)}
                      className="flex-1 py-1 bg-slate-50 border border-slate-200 text-slate-500 text-[9px] font-bold rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all">
                      ✏️ Editar
                    </button>
                    <button onClick={() => handleDelete(m.id)}
                      className="py-1 px-2 bg-red-50 border border-red-200 text-red-400 text-[9px] font-bold rounded-lg hover:bg-red-100 hover:text-red-600 transition-all">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit/Add form modal */}
        {showForm && editing && (
          <MaterialForm
            material={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Material form modal ──────────────────────────────────────────────────────

function MaterialForm({
  material,
  onSave,
  onCancel,
}: {
  material: CatalogMaterial
  onSave: (m: CatalogMaterial) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CatalogMaterial>(material)
  const update = (field: keyof CatalogMaterial, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
        <h3 className="text-sm font-black uppercase text-slate-800 mb-4">
          {material.name ? '✏️ Editar Material' : '+ Nuevo Material'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase">Nombre</label>
            <input className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="Contrachapado Chopo 16mm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Categoría</label>
              <select className="w-full mt-0.5 px-2 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.category} onChange={e => update('category', e.target.value)}>
                {MATERIAL_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Etiqueta textura</label>
              <input className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.texture_label} onChange={e => update('texture_label', e.target.value)}
                placeholder="Roble" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Grosor (mm)</label>
              <input type="number" min={1}
                className="w-full mt-0.5 px-2 py-2 border border-slate-200 rounded-lg text-xs font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.thickness} onChange={e => update('thickness', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Precio €/m²</label>
              <input type="number" min={0} step={0.5}
                className="w-full mt-0.5 px-2 py-2 border border-slate-200 rounded-lg text-xs font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.price_per_m2} onChange={e => update('price_per_m2', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase">Color</label>
              <div className="flex items-center gap-1.5 mt-0.5">
                <input type="color"
                  className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                  value={form.color_hex} onChange={e => update('color_hex', e.target.value)} />
                <input className="flex-1 px-2 py-2 border border-slate-200 rounded-lg text-[10px] font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.color_hex} onChange={e => update('color_hex', e.target.value)} />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.in_stock}
              onChange={e => update('in_stock', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-blue-500" />
            <span className="text-xs font-bold text-slate-600">En stock</span>
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onCancel}
            className="flex-1 py-2 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-200 transition-all">
            Cancelar
          </button>
          <button onClick={() => onSave(form)}
            disabled={!form.name.trim()}
            className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all">
            💾 Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
