/**
 * useConfirm — React-safe replacement for window.confirm()
 *
 * Returns [ConfirmDialog, confirm] where:
 *  - ConfirmDialog: a JSX element to render (portal-based modal)
 *  - confirm(message, onOk): triggers the dialog; onOk runs if user confirms
 *
 * Usage:
 *   const [ConfirmDialog, confirm] = useConfirm()
 *   confirm('¿Eliminar?', () => doDelete())
 *   return <>{ConfirmDialog}</>
 */

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '@/shared/utils/portalRoot'

interface ConfirmState {
  message: string
  onOk: () => void
}

export function useConfirm(): [JSX.Element | null, (message: string, onOk: () => void) => void] {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((message: string, onOk: () => void) => {
    setState({ message, onOk })
  }, [])

  const handleOk = () => {
    state?.onOk()
    setState(null)
  }

  const dialog = state
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setState(null)}
        >
          <div
            className="bg-white rounded-xl p-5 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-gray-800 mb-4 whitespace-pre-line">{state.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setState(null)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleOk}
                className="text-sm px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 font-medium transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        getPortalRoot()
      )
    : null

  return [dialog, confirm]
}
