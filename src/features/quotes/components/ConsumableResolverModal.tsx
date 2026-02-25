/**
 * ConsumableResolverModal.tsx
 *
 * Shown when a catalog product contains consumables whose names are
 * generic (e.g. "lavabo") and cannot be matched exactly to a stock item.
 *
 * For each such consumable the modal searches the product catalog for
 * items whose NOMBRE contains the generic name, and lets the user pick
 * the exact variant before the product is added to the quote.
 */

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { CatalogProduct } from '../types/quote.types'

// ─── Types ────────────────────────────────────────────────────

export interface UnresolvedConsumable {
  /** 1-based index (CONSUMIBLE_1 … CONSUMIBLE_10) */
  index: number
  /** Original generic name from catalog, e.g. "lavabo" */
  genericName: string
  quantity: number
  unit: string
  /** Catalog products whose NOMBRE contains genericName */
  matches: CatalogProduct[]
  /** SKU of currently selected match (pre-selected to first match) */
  selectedSKU: string
  /** Whether the user chose to skip resolution for this consumable */
  skipped: boolean
}

interface ConsumableResolverModalProps {
  /** Product being added */
  productName: string
  unresolved: UnresolvedConsumable[]
  /** Full product catalog — used for searching when pre-matched list is empty */
  allProducts: CatalogProduct[]
  onConfirm: (resolved: UnresolvedConsumable[]) => void
  onSkipAll: () => void
  onCancel: () => void
}

// ─── Component ────────────────────────────────────────────────

export default function ConsumableResolverModal({
  productName,
  unresolved: initial,
  allProducts,
  onConfirm,
  onSkipAll,
  onCancel,
}: ConsumableResolverModalProps) {
  /** Normalize text: lowercase, trim, unify decimal separators (, → .) */
  const norm = (s: string) => s.toLowerCase().trim().replace(/,/g, '.')

  // Compute / enrich matches from the full catalog+stock on mount
  const [items, setItems] = useState<UnresolvedConsumable[]>(() =>
    initial.map(item => {
      if (item.matches.length > 0) return item
      // Pre-computed matches were empty — compute from full pool with normalized text
      const nameLower = norm(item.genericName)
      const nameWords = nameLower.split(/\s+/).filter(w => w.length >= 3)
      const matches = allProducts.filter(p => {
        const pName = norm(p.NOMBRE || '')
        if (pName.includes(nameLower) || nameLower.includes(pName)) return true
        if (nameWords.length > 0 && nameWords.every(w => pName.includes(w))) return true
        return false
      })
      return { ...item, matches, selectedSKU: matches[0]?.SKU ?? '' }
    })
  )
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({})

  const updateSelected = (index: number, sku: string) => {
    setItems(prev => prev.map(c => c.index === index ? { ...c, selectedSKU: sku, skipped: false } : c))
  }

  const toggleSkip = (index: number) => {
    setItems(prev => prev.map(c => c.index === index ? { ...c, skipped: !c.skipped } : c))
  }

  const setSearch = (index: number, term: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: term }))
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b bg-amber-50 rounded-t-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🧩</span>
            <div>
              <h2 className="font-bold text-gray-900">Consumibles genéricos detectados</h2>
              <p className="text-xs text-gray-600 mt-0.5">
                <strong>{productName}</strong> contiene consumibles cuyo nombre es genérico y no coincide
                exactamente con ningún artículo en stock. Selecciona el producto específico para cada uno.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.map(c => {
            const searchTerm = searchTerms[c.index] ?? ''
            const hasPreMatches = c.matches.length > 0
            // If no pre-matched results, search the FULL catalog when user types
            const searchPool = hasPreMatches ? c.matches : allProducts
            const searchNorm = norm(searchTerm)
            const filtered = searchTerm
              ? searchPool.filter(m =>
                  norm(m.NOMBRE || '').includes(searchNorm) ||
                  norm(m.SKU || '').includes(searchNorm)
                )
              : c.matches  // default view: only show pre-matched items (empty if none)

            const selectedProduct = [...c.matches, ...allProducts].find(m => m.SKU === c.selectedSKU)

            return (
              <div
                key={c.index}
                className={`border rounded-lg p-3 transition ${c.skipped ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
              >
                {/* Consumable header */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs text-gray-400 font-mono">CONSUMIBLE_{c.index}</span>
                    <p className="font-semibold text-sm">
                      "{c.genericName}"
                      <span className="text-gray-500 font-normal ml-1">× {c.quantity} {c.unit}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {c.matches.length > 0
                        ? `${c.matches.length} coincidencias en catálogo`
                        : '⚠️ Sin coincidencias — busca en el catálogo completo'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => toggleSkip(c.index)}
                    className={`text-xs px-2 py-1 rounded border transition ${
                      c.skipped
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {c.skipped ? '✋ Omitido' : 'Omitir'}
                  </button>
                </div>

                {!c.skipped && (
                  <>
                    {/* Search — always show when no pre-matches, or when >5 pre-matches */}
                    {(c.matches.length === 0 || c.matches.length > 5) && (
                      <Input
                        placeholder={c.matches.length === 0 ? '🔍 Buscar en catálogo completo...' : '🔍 Filtrar variantes...'}
                        value={searchTerm}
                        onChange={e => setSearch(c.index, e.target.value)}
                        className="mb-2 h-7 text-xs"
                        autoFocus={c.matches.length === 0}
                      />
                    )}

                    {/* Options list */}
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {filtered.map(match => (
                        <label
                          key={match.SKU}
                          className={`flex items-start gap-2 p-2 rounded cursor-pointer text-xs transition ${
                            c.selectedSKU === match.SKU
                              ? 'bg-blue-50 border border-blue-300'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`consumable-${c.index}`}
                            value={match.SKU}
                            checked={c.selectedSKU === match.SKU}
                            onChange={() => updateSelected(c.index, match.SKU)}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{match.NOMBRE}</p>
                            <p className="text-gray-400">{match.SKU} · {match.FAMILIA}</p>
                          </div>
                          {match.PRECIO_COMPRA != null && match.PRECIO_COMPRA > 0 && (
                            <span className="text-gray-700 whitespace-nowrap">{match.PRECIO_COMPRA.toFixed(2)} €</span>
                          )}
                        </label>
                      ))}
                      {filtered.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">
                          {!hasPreMatches && !searchTerm
                            ? 'Escribe para buscar en el catálogo completo'
                            : 'Sin resultados'
                          }
                        </p>
                      )}
                    </div>

                    {selectedProduct && (
                      <p className="mt-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                        ✅ Seleccionado: <strong>{selectedProduct.NOMBRE}</strong>
                      </p>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-gray-50 rounded-b-xl flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => onConfirm(items)}
          >
            ✅ Añadir con selección
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 text-xs"
              onClick={onSkipAll}
            >
              Añadir sin resolver
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-xs"
              onClick={onCancel}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
