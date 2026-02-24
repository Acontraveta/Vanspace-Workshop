/**
 * SignaturePad.tsx
 *
 * Canvas-based signature capture component.
 * Supports touch (finger) and mouse input.
 * Exposes a data:image/png base64 URL via onChange.
 */

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'

export interface SignaturePadRef {
  clear: () => void
  toDataURL: () => string
  isEmpty: () => boolean
}

interface SignaturePadProps {
  width?: number
  height?: number
  label?: string
  onChange?: (dataUrl: string | null) => void
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ width = 400, height = 160, label = 'Firma', onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [drawing, setDrawing] = useState(false)
    const [hasContent, setHasContent] = useState(false)
    const lastPos = useRef<{ x: number; y: number } | null>(null)

    // Resize canvas to CSS pixel dimensions (with device DPR for sharpness)
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = 2
      }
    }, [width, height])

    const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }, [])

    const startStroke = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const canvas = canvasRef.current!
      canvas.setPointerCapture(e.pointerId)
      setDrawing(true)
      lastPos.current = getPos(e)
    }, [getPos])

    const moveStroke = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing || !lastPos.current) return
      e.preventDefault()
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const pos = getPos(e)
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPos.current = pos
      if (!hasContent) setHasContent(true)
    }, [drawing, getPos, hasContent])

    const endStroke = useCallback(() => {
      setDrawing(false)
      lastPos.current = null
      if (hasContent && onChange) {
        const canvas = canvasRef.current
        onChange(canvas ? canvas.toDataURL('image/png') : null)
      }
    }, [hasContent, onChange])

    const clear = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      setHasContent(false)
      onChange?.(null)
    }, [onChange])

    useImperativeHandle(ref, () => ({
      clear,
      toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
      isEmpty: () => !hasContent,
    }), [clear, hasContent])

    return (
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          ✍️ {label}
        </label>
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden"
             style={{ touchAction: 'none' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: `${height}px`, cursor: 'crosshair', display: 'block' }}
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
          />
          {!hasContent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-300 text-sm">
              Firme aquí con el dedo o ratón
            </div>
          )}
        </div>
        {hasContent && (
          <button
            type="button"
            onClick={clear}
            className="mt-1 text-xs text-red-500 hover:text-red-700 transition"
          >
            🗑️ Borrar firma
          </button>
        )}
      </div>
    )
  }
)

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad
