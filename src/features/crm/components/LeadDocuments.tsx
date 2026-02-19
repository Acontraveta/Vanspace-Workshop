/**
 * LeadDocuments.tsx
 *
 * Gestiona los documentos adjuntos a un lead del CRM.
 * Almacena los archivos en el bucket Supabase "lead-documents".
 *
 * Muestra:
 *   - Lista de documentos existentes (icono, nombre, categoría, tamaño, fecha)
 *   - Zona de carga (click o drag-and-drop)
 *   - Selector de categoría + campo de notas opcional
 *   - Botones de apertura en pestaña, descarga y eliminación
 */

import { useState, useEffect, useRef, DragEvent, ChangeEvent } from 'react'
import {
  LeadDocumentsService,
  LeadDocument,
  DocCategory,
  DOC_CATEGORIES,
} from '../services/leadDocumentsService'
import type { Lead } from '../types/crm.types'
import toast from 'react-hot-toast'

interface LeadDocumentsProps {
  lead: Lead
}

export function LeadDocuments({ lead }: LeadDocumentsProps) {
  const [docs, setDocs]           = useState<LeadDocument[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const [category, setCategory]   = useState<DocCategory>('otro')
  const [notes, setNotes]         = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    try {
      setLoading(true)
      const data = await LeadDocumentsService.getByLead(lead.id)
      setDocs(data)
    } catch (err: any) {
      toast.error('Error cargando documentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [lead.id])

  // ── Upload ──────────────────────────────────────────────

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (!arr.length) return
    setUploading(true)
    let errors = 0

    for (const file of arr) {
      try {
        await LeadDocumentsService.upload(lead.id, file, category, notes, '')
      } catch (err: any) {
        errors++
        console.error('Upload error:', err)
      }
    }

    if (errors) toast.error(`${errors} archivo(s) no se pudieron subir`)
    else toast.success(`${arr.length} archivo(s) adjuntado(s)`)

    setNotes('')
    setUploading(false)
    refresh()
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files)
  }

  // ── Delete ──────────────────────────────────────────────

  const handleDelete = async (doc: LeadDocument) => {
    if (!confirm(`¿Eliminar "${doc.file_name}"?`)) return
    setDeletingId(doc.id)
    try {
      await LeadDocumentsService.delete(doc.id, doc.file_path)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      toast.success('Documento eliminado')
    } catch (err: any) {
      toast.error('Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Render ──────────────────────────────────────────────

  const catMeta = (val: DocCategory) =>
    DOC_CATEGORIES.find(c => c.value === val) ?? { icon: '📎', label: val }

  return (
    <div className="space-y-4">

      {/* ── Upload zone ──────────────────────────────── */}
      <div className="space-y-3">
        {/* Category + Notes row */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Categoría del documento</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as DocCategory)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {DOC_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Descripción del documento…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-4 cursor-pointer transition
            ${dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {uploading ? (
            <>
              <div className="text-2xl animate-spin">⏳</div>
              <p className="text-sm text-gray-500">Subiendo…</p>
            </>
          ) : (
            <>
              <div className="text-3xl">📁</div>
              <p className="text-sm font-medium text-gray-600">
                Arrastra archivos aquí o <span className="text-blue-600 underline">haz clic para seleccionar</span>
              </p>
              <p className="text-xs text-gray-400">PDF, imágenes, Word, Excel, ZIP — máx. 50 MB por archivo</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* ── Document list ─────────────────────────────── */}
      {loading ? (
        <div className="text-center py-6 text-gray-400 text-sm">Cargando documentos…</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          <p className="text-2xl mb-1">📂</p>
          No hay documentos adjuntos todavía
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const cat = catMeta(doc.doc_category)
            const mimeIcon = LeadDocumentsService.mimeIcon(doc.file_type ?? '')
            const isDeleting = deletingId === doc.id

            return (
              <div
                key={doc.id}
                className={`flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 hover:bg-white transition ${isDeleting ? 'opacity-40' : ''}`}
              >
                {/* File type icon */}
                <span className="text-xl shrink-0">{mimeIcon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    <span className="inline-flex items-center gap-0.5">
                      {cat.icon} {cat.label}
                    </span>
                    <span>·</span>
                    <span>{LeadDocumentsService.formatSize(doc.file_size)}</span>
                    <span>·</span>
                    <span>{new Date(doc.uploaded_at).toLocaleDateString('es-ES')}</span>
                    {doc.notes && (
                      <>
                        <span>·</span>
                        <span className="italic text-gray-500 truncate max-w-[180px]">{doc.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    title="Abrir en nueva pestaña"
                    onClick={() => LeadDocumentsService.openInTab(doc.file_path)}
                    className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition text-sm"
                  >
                    👁️
                  </button>
                  <button
                    type="button"
                    title="Descargar"
                    onClick={() => LeadDocumentsService.download(doc.file_path, doc.file_name)}
                    className="p-1.5 rounded hover:bg-green-100 text-green-600 transition text-sm"
                  >
                    ⬇️
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    disabled={isDeleting}
                    onClick={() => handleDelete(doc)}
                    className="p-1.5 rounded hover:bg-red-100 text-red-500 transition text-sm disabled:opacity-40"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
