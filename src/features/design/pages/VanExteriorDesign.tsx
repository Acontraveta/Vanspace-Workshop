// ── Van Exterior Design ────────────────────────────────────────────
// 4 views: side-left (conductor), side-right (pasajero), top, rear.
// Van size configurable via presets or custom dimensions.
// Elements constrained to the van body with placement dimensions (cotas).
// Each element type has a distinctive SVG symbol for quick identification.
// Solar panels default to top/roof view.

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { FurnitureWorkOrderService } from '../services/furnitureDesignService'
import { FurnitureWorkOrder, FurnitureWorkOrderItem } from '../types/furniture.types'
import {
  VanConfig, VAN_PRESETS, DEFAULT_VAN, DEFAULT_PRESET,
  findPreset, saveVanConfig, loadVanConfig,
} from '../constants/vanPresets'
import { CatalogService } from '@/features/quotes/services/catalogService'
import type { CatalogProduct } from '@/features/quotes/types/quote.types'
import { ProductionService } from '@/features/calendar/services/productionService'
import type { ProductionProject } from '@/features/calendar/types/production.types'

// ── Catalog element types ─────────────────────────────────────────
export interface ExteriorElement {
  id: string
  type: 'ventana' | 'claraboya' | 'aireador' | 'rejilla' | 'portabicis' | 'toldo' | 'placa_solar' | 'custom'
  label: string
  w: number  // mm
  h: number  // mm
  color: string
  fromQuote?: boolean
  quoteItemId?: string
  /** Suggested view for this element type */
  preferredView?: ViewId
}

export interface PlacedElement extends ExteriorElement {
  x: number
  y: number
  view: ViewId
  rotation: number
}

// ── Default palette (real product dimensions) ────────────────────
const DEFAULT_PALETTE: ExteriorElement[] = [
  // Windows — Dometic S4 / Carbest
  { id: 'pal-vent-50x35', type: 'ventana', label: 'Ventana 500×350', w: 500, h: 350, color: '#3b82f6' },
  { id: 'pal-vent-70x40', type: 'ventana', label: 'Ventana 700×400', w: 700, h: 400, color: '#3b82f6' },
  { id: 'pal-vent-90x45', type: 'ventana', label: 'Ventana 900×450', w: 900, h: 450, color: '#3b82f6' },
  { id: 'pal-vent-110x45', type: 'ventana', label: 'Ventana 1100×450', w: 1100, h: 450, color: '#3b82f6' },
  // Skylights — Fiamma & Maxxfan
  { id: 'pal-clara-40x40', type: 'claraboya', label: 'Claraboya 400×400', w: 400, h: 400, color: '#8b5cf6', preferredView: 'top' },
  { id: 'pal-clara-70x50', type: 'claraboya', label: 'Claraboya 700×500', w: 700, h: 500, color: '#8b5cf6', preferredView: 'top' },
  { id: 'pal-maxxfan', type: 'claraboya', label: 'Maxxfan 355×355', w: 355, h: 355, color: '#8b5cf6', preferredView: 'top' },
  // Vents
  { id: 'pal-aireador', type: 'aireador', label: 'Aireador 217×217', w: 217, h: 217, color: '#10b981' },
  { id: 'pal-rejilla-26x13', type: 'rejilla', label: 'Rejilla 260×126', w: 260, h: 126, color: '#f59e0b' },
  { id: 'pal-rejilla-20x10', type: 'rejilla', label: 'Rejilla 200×100', w: 200, h: 100, color: '#f59e0b' },
  // Solar panels — always on top
  { id: 'pal-placa-200w', type: 'placa_solar', label: 'Panel solar 200 W (1580×808)', w: 1580, h: 808, color: '#1e3a5f', preferredView: 'top' },
  { id: 'pal-placa-100w', type: 'placa_solar', label: 'Panel solar 100 W (1020×510)', w: 1020, h: 510, color: '#1e3a5f', preferredView: 'top' },
  { id: 'pal-placa-300w', type: 'placa_solar', label: 'Panel solar 300 W (1650×1000)', w: 1650, h: 1000, color: '#1e3a5f', preferredView: 'top' },
  // Awning & bike rack
  { id: 'pal-toldo', type: 'toldo', label: 'Toldo lateral 3000×2100', w: 3000, h: 2100, color: '#be185d' },
  { id: 'pal-portabicis', type: 'portabicis', label: 'Portabicis trasero 580×420', w: 580, h: 420, color: '#64748b', preferredView: 'rear' },
]

// ── Element visual config ─────────────────────────────────────────
interface ElementVisual {
  shortLabel: string
  bgPattern: string // pattern for fill
  strokeStyle: string
}

const ELEMENT_VISUALS: Record<string, ElementVisual> = {
  ventana:     { shortLabel: 'V',  bgPattern: '#dbeafe', strokeStyle: '#2563eb' },
  claraboya:   { shortLabel: 'CL', bgPattern: '#ede9fe', strokeStyle: '#7c3aed' },
  aireador:    { shortLabel: 'A',  bgPattern: '#d1fae5', strokeStyle: '#059669' },
  rejilla:     { shortLabel: 'R',  bgPattern: '#fef3c7', strokeStyle: '#d97706' },
  placa_solar: { shortLabel: 'PS', bgPattern: '#1e3a5f20', strokeStyle: '#1e3a5f' },
  toldo:       { shortLabel: 'T',  bgPattern: '#fce7f3', strokeStyle: '#be185d' },
  portabicis:  { shortLabel: 'PB', bgPattern: '#f1f5f9', strokeStyle: '#475569' },
  custom:      { shortLabel: '?',  bgPattern: '#f1f5f9', strokeStyle: '#64748b' },
}

// ── SVG Symbol drawings per type ─────────────────────────────────
function ElementSymbol({ el, isSelected }: { el: PlacedElement; isSelected: boolean }) {
  const vis = ELEMENT_VISUALS[el.type] ?? ELEMENT_VISUALS.custom
  const cx = el.x + el.w / 2
  const cy = el.y + el.h / 2
  const fs = Math.min(55, Math.max(22, el.w / 6))
  const selStroke = isSelected ? '#f43f5e' : vis.strokeStyle
  const selWidth = isSelected ? 8 : 4
  const selDash = isSelected ? '15,5' : 'none'

  switch (el.type) {
    case 'ventana':
      return (
        <g>
          {/* Glass pane with cross bars */}
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6}
            fill="#bfdbfe80" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={selDash} />
          <line x1={el.x + 12} y1={cy} x2={el.x + el.w - 12} y2={cy}
            stroke="#93c5fd" strokeWidth="3" />
          <line x1={cx} y1={el.y + 12} x2={cx} y2={el.y + el.h - 12}
            stroke="#93c5fd" strokeWidth="3" />
          {/* Corner reflection */}
          <path d={`M ${el.x + el.w * 0.1} ${el.y + el.h * 0.15}
            L ${el.x + el.w * 0.3} ${el.y + el.h * 0.15}
            L ${el.x + el.w * 0.1} ${el.y + el.h * 0.35}`}
            fill="none" stroke="#60a5fa80" strokeWidth="4" strokeLinecap="round" />
        </g>
      )

    case 'claraboya':
      return (
        <g>
          {/* Rounded skylight with frame */}
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={Math.min(el.w, el.h) * 0.15}
            fill="#c4b5fd60" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={selDash} />
          <rect x={el.x + 15} y={el.y + 15} width={el.w - 30} height={el.h - 30}
            rx={Math.min(el.w, el.h) * 0.1}
            fill="#ddd6fe40" stroke="#8b5cf680" strokeWidth="3" />
          {/* Fan blades hint */}
          <circle cx={cx} cy={cy} r={Math.min(el.w, el.h) * 0.18}
            fill="none" stroke="#8b5cf650" strokeWidth="3" />
          <path d={`M ${cx} ${cy - 12} A 12 12 0 0 1 ${cx + 12} ${cy}`}
            fill="none" stroke="#8b5cf660" strokeWidth="4" />
        </g>
      )

    case 'aireador':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={el.w * 0.15}
            fill="#a7f3d060" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={selDash} />
          {/* Vent slats */}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={el.x + el.w * 0.15} y1={el.y + el.h * f}
              x2={el.x + el.w * 0.85} y2={el.y + el.h * f}
              stroke="#059669" strokeWidth="3" strokeLinecap="round" />
          ))}
        </g>
      )

    case 'rejilla':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={4}
            fill="#fef3c780" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={selDash} />
          {/* Grid pattern */}
          {[0.2, 0.4, 0.6, 0.8].map(f => (
            <line key={f} x1={el.x + el.w * f} y1={el.y + 8}
              x2={el.x + el.w * f} y2={el.y + el.h - 8}
              stroke="#d9770680" strokeWidth="2" />
          ))}
          {[0.33, 0.66].map(f => (
            <line key={f} x1={el.x + 8} y1={el.y + el.h * f}
              x2={el.x + el.w - 8} y2={el.y + el.h * f}
              stroke="#d9770680" strokeWidth="2" />
          ))}
        </g>
      )

    case 'placa_solar':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={4}
            fill="#1e3a5f25" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={selDash} />
          {/* Solar cell grid */}
          {Array.from({ length: 5 }, (_, i) => (i + 1) / 6).map(f => (
            <line key={`v${f}`} x1={el.x + el.w * f} y1={el.y + 10}
              x2={el.x + el.w * f} y2={el.y + el.h - 10}
              stroke="#1e3a5f40" strokeWidth="2" />
          ))}
          {Array.from({ length: 3 }, (_, i) => (i + 1) / 4).map(f => (
            <line key={`h${f}`} x1={el.x + 10} y1={el.y + el.h * f}
              x2={el.x + el.w - 10} y2={el.y + el.h * f}
              stroke="#1e3a5f40" strokeWidth="2" />
          ))}
          {/* Corner cells filled */}
          <rect x={el.x + 8} y={el.y + 8} width={el.w / 6 - 10} height={el.h / 4 - 10}
            fill="#1e3a5f15" rx={2} />
        </g>
      )

    case 'toldo':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6}
            fill="#fce7f340" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={selDash} />
          {/* Awning stripes */}
          {Array.from({ length: Math.floor(el.w / 200) }, (_, i) => i * 200).map(off => (
            <rect key={off} x={el.x + off} y={el.y} width={100} height={el.h}
              fill="#be185d10" />
          ))}
          {/* Roll bar */}
          <line x1={el.x} y1={el.y + 8} x2={el.x + el.w} y2={el.y + 8}
            stroke="#be185d60" strokeWidth="6" strokeLinecap="round" />
        </g>
      )

    case 'portabicis':
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6}
            fill="#f1f5f980" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={selDash} />
          {/* Bike wheel circles */}
          {[0.35, 0.65].map(f => (
            <circle key={f} cx={el.x + el.w * f} cy={cy}
              r={Math.min(el.w, el.h) * 0.18}
              fill="none" stroke="#47556980" strokeWidth="4" />
          ))}
          {/* Frame */}
          <line x1={el.x + el.w * 0.35} y1={cy}
            x2={el.x + el.w * 0.65} y2={cy}
            stroke="#47556950" strokeWidth="4" />
        </g>
      )

    default:
      return (
        <g>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6}
            fill={el.color + '25'} stroke={selStroke} strokeWidth={selWidth} strokeDasharray={selDash} />
        </g>
      )
  }
}

// ── Placement dimensions (cotas) ─────────────────────────────────
function PlacementCotas({ el, van }: { el: PlacedElement; van: VanConfig }) {
  const bodyTop = van.height - van.bodyHeight
  const bs = van.bodyStart

  // Distance from body start (horizontal, for side views)
  if (el.view === 'side-left' || el.view === 'side-right') {
    const dFromBodyStart = el.x - bs
    const dFromFloor = van.height - (el.y + el.h) // distance from bottom to element bottom
    const dFromRoof = el.y - bodyTop // distance from roof line to element top
    const cotaColor = '#f43f5e'
    return (
      <g style={{ pointerEvents: 'none' }}>
        {/* Horizontal cota: distance from body start */}
        <line x1={bs} y1={el.y - 30} x2={el.x} y2={el.y - 30}
          stroke={cotaColor} strokeWidth="2" markerStart="url(#arrowL)" markerEnd="url(#arrowR)" />
        <text x={(bs + el.x) / 2} y={el.y - 40} textAnchor="middle"
          fontSize="40" fill={cotaColor} fontWeight="700" fontFamily="Arial">
          {dFromBodyStart} mm
        </text>

        {/* Vertical cota: distance from floor (bottom) */}
        <line x1={el.x + el.w + 25} y1={el.y + el.h} x2={el.x + el.w + 25} y2={van.height}
          stroke={cotaColor} strokeWidth="2" markerStart="url(#arrowU)" markerEnd="url(#arrowD)" />
        <text x={el.x + el.w + 35} y={(el.y + el.h + van.height) / 2 + 12}
          fontSize="36" fill={cotaColor} fontWeight="700" fontFamily="Arial"
          transform={`rotate(-90 ${el.x + el.w + 35} ${(el.y + el.h + van.height) / 2 + 12})`}
          textAnchor="middle">
          ↕ {dFromFloor}
        </text>

        {/* Element dimensions inline */}
        <text x={el.x + el.w / 2} y={el.y + el.h + 40} textAnchor="middle"
          fontSize="34" fill="#64748b" fontWeight="600" fontFamily="Arial">
          {el.w}×{el.h}
        </text>
      </g>
    )
  }

  if (el.view === 'top') {
    const dFromBodyStart = el.x - bs
    const dFromLeftEdge = el.y - 60  // from top edge of van body
    return (
      <g style={{ pointerEvents: 'none' }}>
        {/* Horizontal cota from body start */}
        <line x1={bs} y1={el.y - 25} x2={el.x} y2={el.y - 25}
          stroke="#f43f5e" strokeWidth="2" />
        <text x={(bs + el.x) / 2} y={el.y - 35} textAnchor="middle"
          fontSize="38" fill="#f43f5e" fontWeight="700" fontFamily="Arial">
          {dFromBodyStart}
        </text>
        {/* Vertical cota from left edge */}
        <line x1={el.x - 25} y1={60} x2={el.x - 25} y2={el.y}
          stroke="#f43f5e" strokeWidth="2" />
        <text x={el.x - 35} y={(60 + el.y) / 2} textAnchor="middle"
          fontSize="36" fill="#f43f5e" fontWeight="700" fontFamily="Arial"
          transform={`rotate(-90 ${el.x - 35} ${(60 + el.y) / 2})`}>
          {dFromLeftEdge}
        </text>
        {/* Size */}
        <text x={el.x + el.w / 2} y={el.y + el.h + 40} textAnchor="middle"
          fontSize="34" fill="#64748b" fontWeight="600" fontFamily="Arial">
          {el.w}×{el.h}
        </text>
      </g>
    )
  }

  if (el.view === 'rear') {
    const dFromLeft = el.x - 80
    const dFromFloor = van.height - (el.y + el.h)
    return (
      <g style={{ pointerEvents: 'none' }}>
        <line x1={80} y1={el.y - 25} x2={el.x} y2={el.y - 25}
          stroke="#f43f5e" strokeWidth="2" />
        <text x={(80 + el.x) / 2} y={el.y - 35} textAnchor="middle"
          fontSize="38" fill="#f43f5e" fontWeight="700" fontFamily="Arial">
          {dFromLeft}
        </text>
        <text x={el.x + el.w / 2} y={el.y + el.h + 40} textAnchor="middle"
          fontSize="34" fill="#64748b" fontWeight="600" fontFamily="Arial">
          {el.w}×{el.h}
        </text>
      </g>
    )
  }

  return null
}

// ── Marker defs for arrows ────────────────────────────────────────
function CotaMarkers() {
  return (
    <defs>
      <marker id="arrowR" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <path d="M 0 0 L 8 3 L 0 6" fill="#f43f5e" />
      </marker>
      <marker id="arrowL" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
        <path d="M 8 0 L 0 3 L 8 6" fill="#f43f5e" />
      </marker>
      <marker id="arrowU" markerWidth="6" markerHeight="8" refX="3" refY="0" orient="auto">
        <path d="M 0 8 L 3 0 L 6 8" fill="#f43f5e" />
      </marker>
      <marker id="arrowD" markerWidth="6" markerHeight="8" refX="3" refY="8" orient="auto">
        <path d="M 0 0 L 3 8 L 6 0" fill="#f43f5e" />
      </marker>
    </defs>
  )
}

// ── Views ─────────────────────────────────────────────────────────
type ViewId = 'side-left' | 'side-right' | 'top' | 'rear'

interface ViewConfig {
  id: ViewId
  label: string
  icon: string
  svgW: number
  svgH: number
}

function getViews(van: VanConfig): ViewConfig[] {
  return [
    { id: 'side-left', label: 'Izquierdo (conductor)', icon: '◀️', svgW: van.length, svgH: van.height },
    { id: 'side-right', label: 'Derecho (pasajero)', icon: '▶️', svgW: van.length, svgH: van.height },
    { id: 'top', label: 'Planta (techo)', icon: '⬇️', svgW: van.length, svgH: van.width },
    { id: 'rear', label: 'Trasero', icon: '🔙', svgW: van.width, svgH: van.height },
  ]
}

// ── Body bounds per view ─────────────────────────────────────────
function getBodyBounds(view: ViewId, van: VanConfig) {
  const bodyTop = van.height - van.bodyHeight
  switch (view) {
    case 'side-left':
    case 'side-right':
      return { minX: van.bodyStart, maxX: van.bodyStart + van.bodyLength, minY: bodyTop, maxY: van.height - 100 }
    case 'top':
      return { minX: van.bodyStart, maxX: van.bodyStart + van.bodyLength, minY: 60, maxY: van.width - 60 }
    case 'rear':
      return { minX: 80, maxX: van.width - 80, minY: bodyTop, maxY: van.height - 100 }
  }
}

function clamp(x: number, y: number, w: number, h: number, view: ViewId, van: VanConfig) {
  const b = getBodyBounds(view, van)
  return {
    x: Math.max(b.minX, Math.min(b.maxX - w, x)),
    y: Math.max(b.minY, Math.min(b.maxY - h, y)),
  }
}

// ── SVG Van drawings ─────────────────────────────────────────────
function VanSideLeftSVG({ van }: { van: VanConfig }) {
  const { bodyStart: bs, bodyLength: bl, bodyHeight: bh, height: h,
    wheelDia: wd, frontWheelX: fwx, rearWheelX: rwx, roofArc: ra, length: len } = van
  const bodyTop = h - bh
  const bodyEnd = bs + bl
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      <path d={`M ${bs} ${bodyTop} L ${bs * 0.3} ${bodyTop + 300}
        Q 40 ${h - wd * 0.6} 40 ${h - wd * 0.4}
        L 40 ${h} L ${len - 40} ${h}
        L ${len - 40} ${bodyTop + ra}
        Q ${len - 40} ${bodyTop} ${bodyEnd} ${bodyTop}
        L ${bs} ${bodyTop} Z`} fill="#f1f5f9" />
      <path d={`M ${bs} ${bodyTop} Q ${bs + bl / 2} ${bodyTop - ra} ${bodyEnd} ${bodyTop}`}
        fill="none" strokeWidth="6" />
      <rect x={bs * 0.35} y={bodyTop + 320} width={bs * 0.55} height={bh - 520}
        rx={12} fill="none" stroke="#94a3b8" strokeWidth="4" strokeDasharray="15,8" />
      <text x={bs * 0.62} y={bodyTop + bh / 2 + 40} textAnchor="middle"
        fontSize="55" fill="#cbd5e1" fontFamily="Arial">Puerta</text>
      <line x1={bs} y1={bodyTop} x2={bs * 0.3} y2={bodyTop + 300}
        strokeWidth="6" stroke="#60a5fa" />
      <circle cx={fwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={rwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={fwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      <circle cx={rwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      {Array.from({ length: Math.floor(len / 1000) }, (_, i) => (i + 1) * 1000).map(x => (
        <line key={x} x1={x} y1={bodyTop - 40} x2={x} y2={h + 30}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20,10" />
      ))}
      <text x={bs + bl / 2} y={h + 100} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{len} mm</text>
      <text x={bs + bl / 2} y={h + 180} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">zona carga: {bl} mm</text>
      <text x={-60} y={bodyTop + bh / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${bodyTop + bh / 2})`}>{bh} mm</text>
      <line x1={bs} y1={bodyTop - 30} x2={bs} y2={h + 30}
        stroke="#60a5fa" strokeWidth="2" strokeDasharray="10,6" />
      <line x1={bodyEnd} y1={bodyTop - 30} x2={bodyEnd} y2={h + 30}
        stroke="#60a5fa" strokeWidth="2" strokeDasharray="10,6" />
      <text x={len / 2} y={bodyTop - 60} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontWeight="600" fontFamily="Arial">LADO IZQUIERDO (conductor)</text>
    </g>
  )
}

function VanSideRightSVG({ van }: { van: VanConfig }) {
  const { bodyStart: bs, bodyLength: bl, bodyHeight: bh, height: h,
    wheelDia: wd, frontWheelX: fwx, rearWheelX: rwx, roofArc: ra, length: len } = van
  const bodyTop = h - bh
  const bodyEnd = bs + bl
  const doorX = bs + 200
  const doorW = Math.min(1200, bl * 0.35)
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      <path d={`M ${bs} ${bodyTop} L ${bs * 0.3} ${bodyTop + 300}
        Q 40 ${h - wd * 0.6} 40 ${h - wd * 0.4}
        L 40 ${h} L ${len - 40} ${h}
        L ${len - 40} ${bodyTop + ra}
        Q ${len - 40} ${bodyTop} ${bodyEnd} ${bodyTop}
        L ${bs} ${bodyTop} Z`} fill="#f1f5f9" />
      <path d={`M ${bs} ${bodyTop} Q ${bs + bl / 2} ${bodyTop - ra} ${bodyEnd} ${bodyTop}`}
        fill="none" strokeWidth="6" />
      <rect x={doorX} y={bodyTop + 60} width={doorW} height={bh - 180}
        rx={12} fill="#e0f2fe20" stroke="#38bdf8" strokeWidth="5" strokeDasharray="20,10" />
      <text x={doorX + doorW / 2} y={bodyTop + bh / 2} textAnchor="middle"
        fontSize="60" fill="#7dd3fc" fontFamily="Arial">Puerta corredera</text>
      <line x1={bs} y1={bodyTop} x2={bs * 0.3} y2={bodyTop + 300}
        strokeWidth="6" stroke="#60a5fa" />
      <circle cx={fwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={rwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={fwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      <circle cx={rwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      {Array.from({ length: Math.floor(len / 1000) }, (_, i) => (i + 1) * 1000).map(x => (
        <line key={x} x1={x} y1={bodyTop - 40} x2={x} y2={h + 30}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20,10" />
      ))}
      <text x={bs + bl / 2} y={h + 100} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{len} mm</text>
      <text x={bs + bl / 2} y={h + 180} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">zona carga: {bl} mm</text>
      <text x={-60} y={bodyTop + bh / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${bodyTop + bh / 2})`}>{bh} mm</text>
      <line x1={bs} y1={bodyTop - 30} x2={bs} y2={h + 30}
        stroke="#60a5fa" strokeWidth="2" strokeDasharray="10,6" />
      <line x1={bodyEnd} y1={bodyTop - 30} x2={bodyEnd} y2={h + 30}
        stroke="#60a5fa" strokeWidth="2" strokeDasharray="10,6" />
      <text x={len / 2} y={bodyTop - 60} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontWeight="600" fontFamily="Arial">LADO DERECHO (pasajero)</text>
    </g>
  )
}

function VanTopSVG({ van }: { van: VanConfig }) {
  const { length: len, width: w, bodyStart: bs, bodyLength: bl } = van
  const bodyEnd = bs + bl
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      <rect x={40} y={40} width={len - 80} height={w - 80} rx={80} fill="#f1f5f9" />
      <line x1={bs} y1={60} x2={bs} y2={w - 60}
        strokeWidth="4" strokeDasharray="20,10" stroke="#cbd5e1" />
      <line x1={bodyEnd} y1={60} x2={bodyEnd} y2={w - 60}
        strokeWidth="4" strokeDasharray="20,10" stroke="#cbd5e1" />
      <line x1={0} y1={w / 2} x2={len} y2={w / 2}
        strokeWidth="2" strokeDasharray="30,15" stroke="#e2e8f0" />
      {Array.from({ length: Math.floor(len / 1000) }, (_, i) => (i + 1) * 1000).map(x => (
        <line key={x} x1={x} y1={20} x2={x} y2={w - 20}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20,10" />
      ))}
      <text x={bs + bl / 2} y={w + 80} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{len} mm</text>
      <text x={bs + bl / 2} y={w + 160} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">techo carga: {bl} mm</text>
      <text x={-60} y={w / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${w / 2})`}>{w} mm</text>
      <text x={bs + bl / 2} y={80} textAnchor="middle" fontSize="60" fill="#cbd5e1" fontFamily="Arial">IZQ (conductor)</text>
      <text x={bs + bl / 2} y={w - 30} textAnchor="middle" fontSize="60" fill="#cbd5e1" fontFamily="Arial">DER (pasajero)</text>
      <text x={bs - 120} y={w / 2} textAnchor="middle" fontSize="60" fill="#cbd5e1" fontFamily="Arial"
        transform={`rotate(-90 ${bs - 120} ${w / 2})`}>← FRONTAL</text>
    </g>
  )
}

function VanRearSVG({ van }: { van: VanConfig }) {
  const { width: w, height: h, bodyHeight: bh, roofArc: ra } = van
  const bodyTop = h - bh
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      <path d={`M 60 ${h} L 60 ${bodyTop + ra}
        Q ${w / 2} ${bodyTop - ra} ${w - 60} ${bodyTop + ra}
        L ${w - 60} ${h} Z`} fill="#f1f5f9" />
      <line x1={w / 2} y1={bodyTop + ra + 40} x2={w / 2} y2={h - 40}
        strokeWidth="4" strokeDasharray="15,8" stroke="#cbd5e1" />
      <rect x={w / 2 - 60} y={h - bh / 2 - 30} width={50} height={60} rx={10} fill="none" stroke="#94a3b8" strokeWidth="4" />
      <rect x={w / 2 + 10} y={h - bh / 2 - 30} width={50} height={60} rx={10} fill="none" stroke="#94a3b8" strokeWidth="4" />
      <ellipse cx={160} cy={h - 20} rx={140} ry={100} fill="#475569" stroke="#334155" strokeWidth="8" />
      <ellipse cx={w - 160} cy={h - 20} rx={140} ry={100} fill="#475569" stroke="#334155" strokeWidth="8" />
      <text x={w / 2} y={h + 80} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{w} mm</text>
      <text x={-60} y={bodyTop + bh / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${bodyTop + bh / 2})`}>{bh} mm</text>
      <text x={100} y={bodyTop + ra + 100} fontSize="55" fill="#cbd5e1" fontFamily="Arial">IZQ</text>
      <text x={w - 260} y={bodyTop + ra + 100} fontSize="55" fill="#cbd5e1" fontFamily="Arial">DER</text>
    </g>
  )
}

// ── Helpers: map quote item names to ExteriorElement types ──────
const EXTERIOR_TYPE_MAP: { keywords: string[]; type: ExteriorElement['type']; color: string; defaultW: number; defaultH: number; preferredView?: ViewId }[] = [
  { keywords: ['ventana'],                   type: 'ventana',      color: '#3b82f6', defaultW: 700, defaultH: 400 },
  { keywords: ['claraboya'],                 type: 'claraboya',    color: '#8b5cf6', defaultW: 400, defaultH: 400, preferredView: 'top' },
  { keywords: ['maxxfan', 'maxfan'],         type: 'claraboya',    color: '#8b5cf6', defaultW: 355, defaultH: 355, preferredView: 'top' },
  { keywords: ['aireador'],                  type: 'aireador',     color: '#10b981', defaultW: 217, defaultH: 217 },
  { keywords: ['rejilla'],                   type: 'rejilla',      color: '#f59e0b', defaultW: 260, defaultH: 126 },
  { keywords: ['placa solar', 'placa_solar', 'solar'], type: 'placa_solar', color: '#1e3a5f', defaultW: 1580, defaultH: 808, preferredView: 'top' },
  { keywords: ['toldo'],                     type: 'toldo',        color: '#be185d', defaultW: 3000, defaultH: 2100 },
  { keywords: ['portabicis', 'bici'],        type: 'portabicis',   color: '#64748b', defaultW: 580, defaultH: 420, preferredView: 'rear' },
]

function quoteItemToExteriorElement(item: FurnitureWorkOrderItem, idx: number): ExteriorElement {
  const nameLower = item.quoteItemName.toLowerCase()
  const dimMatch = nameLower.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/)
  const parsedW = dimMatch ? parseInt(dimMatch[1]) : undefined
  const parsedH = dimMatch ? parseInt(dimMatch[2]) : undefined

  for (const mapping of EXTERIOR_TYPE_MAP) {
    if (mapping.keywords.some(k => nameLower.includes(k))) {
      return {
        id: `wo-ext-${idx}-${Date.now()}`,
        type: mapping.type,
        label: item.quoteItemName,
        w: parsedW ?? mapping.defaultW,
        h: parsedH ?? mapping.defaultH,
        color: mapping.color,
        fromQuote: true,
        quoteItemId: item.quoteItemSku,
        preferredView: mapping.preferredView,
      }
    }
  }
  return {
    id: `wo-ext-${idx}-${Date.now()}`,
    type: 'custom',
    label: item.quoteItemName,
    w: parsedW ?? 400,
    h: parsedH ?? 300,
    color: '#64748b',
    fromQuote: true,
    quoteItemId: item.quoteItemSku,
  }
}

// ── Map catalog product → ExteriorElement (for free mode) ────────
function catalogToExteriorElement(p: CatalogProduct, idx: number): ExteriorElement | null {
  const nameLower = (p.NOMBRE || '').toLowerCase()
  const famLower = (p.FAMILIA || '').toLowerCase()
  const catLower = (p.CATEGORIA || '').toLowerCase()
  const all = `${nameLower} ${famLower} ${catLower}`

  const dimMatch = nameLower.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/)
  const parsedW = dimMatch ? parseInt(dimMatch[1]) : undefined
  const parsedH = dimMatch ? parseInt(dimMatch[2]) : undefined

  for (const mapping of EXTERIOR_TYPE_MAP) {
    if (mapping.keywords.some(k => all.includes(k))) {
      return {
        id: `cat-ext-${idx}-${p.SKU || Date.now()}`,
        type: mapping.type,
        label: p.NOMBRE,
        w: parsedW ?? mapping.defaultW,
        h: parsedH ?? mapping.defaultH,
        color: mapping.color,
        preferredView: mapping.preferredView,
      }
    }
  }
  return null // no match → skip
}

// ── Van config panel ──────────────────────────────────────────────
function VanConfigPanel({ config, preset, onPreset, onChange }: {
  config: VanConfig
  preset: string
  onPreset: (key: string) => void
  onChange: (c: VanConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const fields: { key: keyof VanConfig; label: string }[] = [
    { key: 'length', label: 'Largo total' },
    { key: 'width', label: 'Ancho total' },
    { key: 'height', label: 'Alto total' },
    { key: 'bodyStart', label: 'Inicio carga' },
    { key: 'bodyLength', label: 'Largo carga' },
    { key: 'bodyHeight', label: 'Alto carga' },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
        <span>🚐 Furgoneta: {VAN_PRESETS[preset]?.label ?? 'Personalizado'}</span>
        <span className="text-xs text-slate-400">{open ? '▲' : '▼'} {config.length}×{config.width}×{config.height} mm</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          <div className="flex items-center gap-2 pt-3">
            <label className="text-xs text-slate-500">Modelo:</label>
            <select value={preset}
              onChange={e => onPreset(e.target.value)}
              className="text-xs border rounded-lg px-2 py-1.5 flex-1">
              {Object.entries(VAN_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
              <option value="custom">Personalizado</option>
            </select>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-slate-400 block mb-0.5">{f.label}</label>
                <input type="number" value={config[f.key]} step={50}
                  onChange={e => {
                    onChange({ ...config, [f.key]: +e.target.value })
                    onPreset('custom')
                  }}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Todas las medidas en mm.</p>
        </div>
      )}
    </div>
  )
}

// ── Legend entries ─────────────────────────────────────────────────
const LEGEND_ITEMS: { type: ExteriorElement['type']; label: string; desc: string }[] = [
  { type: 'ventana', label: 'Ventana', desc: 'Cristal con cruceta — Laterales' },
  { type: 'claraboya', label: 'Claraboya', desc: 'Marco redondeado — Techo' },
  { type: 'aireador', label: 'Aireador', desc: 'Lamas horizontales — Laterales' },
  { type: 'rejilla', label: 'Rejilla', desc: 'Cuadrícula — Laterales/Trasero' },
  { type: 'placa_solar', label: 'Panel solar', desc: 'Celdas fotovoltaicas — Techo' },
  { type: 'toldo', label: 'Toldo', desc: 'Franjas rayadas — Lateral' },
  { type: 'portabicis', label: 'Portabicis', desc: 'Ruedas circulares — Trasero' },
]

// Mini symbol for legend (30×20 px)
function LegendMiniSymbol({ type }: { type: string }) {
  const vis = ELEMENT_VISUALS[type] ?? ELEMENT_VISUALS.custom
  const w = 36
  const h = 24
  switch (type) {
    case 'ventana':
      return (
        <svg width={w} height={h} viewBox="0 0 36 24">
          <rect x={1} y={1} width={34} height={22} rx={2} fill="#bfdbfe" stroke={vis.strokeStyle} strokeWidth="1.5" />
          <line x1={18} y1={2} x2={18} y2={22} stroke="#93c5fd" strokeWidth="1" />
          <line x1={2} y1={12} x2={34} y2={12} stroke="#93c5fd" strokeWidth="1" />
        </svg>
      )
    case 'claraboya':
      return (
        <svg width={w} height={h} viewBox="0 0 36 24">
          <rect x={1} y={1} width={34} height={22} rx={6} fill="#c4b5fd80" stroke={vis.strokeStyle} strokeWidth="1.5" />
          <circle cx={18} cy={12} r={5} fill="none" stroke="#8b5cf680" strokeWidth="1" />
        </svg>
      )
    case 'aireador':
      return (
        <svg width={w} height={h} viewBox="0 0 36 24">
          <rect x={1} y={1} width={34} height={22} rx={4} fill="#a7f3d080" stroke={vis.strokeStyle} strokeWidth="1.5" />
          {[7, 12, 17].map(y => <line key={y} x1={6} y1={y} x2={30} y2={y} stroke="#059669" strokeWidth="1" />)}
        </svg>
      )
    case 'rejilla':
      return (
        <svg width={w} height={h} viewBox="0 0 36 24">
          <rect x={1} y={1} width={34} height={22} rx={1} fill="#fef3c7" stroke={vis.strokeStyle} strokeWidth="1.5" />
          {[10, 18, 26].map(x => <line key={x} x1={x} y1={3} x2={x} y2={21} stroke="#d97706" strokeWidth="0.8" />)}
          <line x1={3} y1={12} x2={33} y2={12} stroke="#d97706" strokeWidth="0.8" />
        </svg>
      )
    case 'placa_solar':
      return (
        <svg width={w} height={h} viewBox="0 0 36 24">
          <rect x={1} y={1} width={34} height={22} rx={1} fill="#1e3a5f30" stroke={vis.strokeStyle} strokeWidth="1.5" />
          {[8, 14, 20, 26].map(x => <line key={x} x1={x} y1={3} x2={x} y2={21} stroke="#1e3a5f50" strokeWidth="0.7" />)}
          {[8, 16].map(y => <line key={y} x1={3} y1={y} x2={33} y2={y} stroke="#1e3a5f50" strokeWidth="0.7" />)}
        </svg>
      )
    case 'toldo':
      return (
        <svg width={w} height={h} viewBox="0 0 36 24">
          <rect x={1} y={1} width={34} height={22} rx={2} fill="#fce7f360" stroke={vis.strokeStyle} strokeWidth="1.5" />
          {[0, 10, 20, 30].map(x => <rect key={x} x={1 + x * 34 / 36} y={1} width={5} height={22} fill="#be185d15" />)}
          <line x1={1} y1={3} x2={35} y2={3} stroke="#be185d60" strokeWidth="2" />
        </svg>
      )
    case 'portabicis':
      return (
        <svg width={w} height={h} viewBox="0 0 36 24">
          <rect x={1} y={1} width={34} height={22} rx={2} fill="#f1f5f9" stroke={vis.strokeStyle} strokeWidth="1.5" />
          <circle cx={12} cy={12} r={5} fill="none" stroke="#475569" strokeWidth="1.2" />
          <circle cx={24} cy={12} r={5} fill="none" stroke="#475569" strokeWidth="1.2" />
          <line x1={12} y1={12} x2={24} y2={12} stroke="#475569" strokeWidth="1" />
        </svg>
      )
    default:
      return (
        <svg width={w} height={h} viewBox="0 0 36 24">
          <rect x={1} y={1} width={34} height={22} rx={2} fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
          <text x={18} y={16} textAnchor="middle" fontSize="10" fill="#64748b">?</text>
        </svg>
      )
  }
}

// ── Main Component ────────────────────────────────────────────────
export default function VanExteriorDesign() {
  const navigate = useNavigate()
  const { workOrderId, projectId } = useParams<{ workOrderId?: string; projectId?: string }>()
  const isWoMode = !!workOrderId
  const configId = workOrderId ?? projectId ?? 'free'

  const [van, setVan] = useState<VanConfig>(() => loadVanConfig(configId) ?? DEFAULT_VAN)
  const [preset, setPreset] = useState<string>(() => findPreset(van) ?? DEFAULT_PRESET)

  const handlePreset = (key: string) => {
    setPreset(key)
    if (key !== 'custom' && VAN_PRESETS[key]) {
      const cfg = { ...VAN_PRESETS[key] }
      delete (cfg as any).label
      setVan(cfg)
      saveVanConfig(configId, cfg)
    }
  }
  const handleVanChange = (cfg: VanConfig) => {
    setVan(cfg)
    saveVanConfig(configId, cfg)
  }

  const [workOrder, setWorkOrder] = useState<FurnitureWorkOrder | null>(null)
  const [woPalette, setWoPalette] = useState<ExteriorElement[]>([])
  const [elements, setElements] = useState<PlacedElement[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ViewId>('side-left')
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCotas, setShowCotas] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Catalog-based palette for free mode ────────────────────────
  const [catalogPalette, setCatalogPalette] = useState<ExteriorElement[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)

  // ── WO linking for free mode ───────────────────────────────────
  const [linkedWO, setLinkedWO] = useState<FurnitureWorkOrder | null>(null)
  const [availableWOs, setAvailableWOs] = useState<FurnitureWorkOrder[]>([])
  const [showWOSelector, setShowWOSelector] = useState(false)
  const [linkTab, setLinkTab] = useState<'design' | 'production'>('design')

  // ── Production project linking ─────────────────────────────────
  const [linkedPP, setLinkedPP] = useState<ProductionProject | null>(null)
  const [availablePPs, setAvailablePPs] = useState<ProductionProject[]>([])

  // Load catalog products for free mode palette
  useEffect(() => {
    if (isWoMode) return
    ;(async () => {
      try {
        // Siempre cargar fresco desde Supabase para sincronizar entre dispositivos
        let products = await CatalogService.loadFromSupabase()
        if (products.length === 0) products = CatalogService.getProducts()
        const mapped: ExteriorElement[] = []
        const seen = new Set<string>()
        products.forEach((p, idx) => {
          const el = catalogToExteriorElement(p, idx)
          if (el) {
            const key = `${el.type}-${el.label}`
            if (!seen.has(key)) {
              seen.add(key)
              mapped.push(el)
            }
          }
        })
        setCatalogPalette(mapped)
        setCatalogLoaded(true)
      } catch { /* fallback to hardcoded */ }
    })()
  }, [isWoMode])

  // Load available WOs + production projects for linking (free mode only)
  useEffect(() => {
    if (isWoMode) return
    ;(async () => {
      try {
        const wos = await FurnitureWorkOrderService.getAllByType('exterior')
        setAvailableWOs(wos)
      } catch { /* ignore */ }
      try {
        const pps = await ProductionService.getProjects()
        setAvailablePPs(pps)
      } catch { /* ignore */ }
    })()
  }, [isWoMode])

  const views = useMemo(() => getViews(van), [van])
  const viewConfig = views.find(v => v.id === activeView)!

  useEffect(() => {
    if (workOrderId) {
      ;(async () => {
        try {
          const wo = await FurnitureWorkOrderService.getById(workOrderId)
          if (wo) {
            setWorkOrder(wo)
            const palette = (wo.items ?? []).map((item, idx) =>
              quoteItemToExteriorElement(item as FurnitureWorkOrderItem, idx)
            )
            setWoPalette(palette)
          }
          const { data } = await supabase
            .from('exterior_designs')
            .select('elements')
            .eq('work_order_id', workOrderId)
            .maybeSingle()
          if (data?.elements) {
            const migrated = (data.elements as PlacedElement[]).map(el =>
              (el as any).view === 'side' ? { ...el, view: 'side-left' as ViewId } : el
            )
            setElements(migrated)
          }
        } catch { /* empty */ }
      })()
    } else if (projectId) {
      ;(async () => {
        try {
          const { data } = await supabase
            .from('exterior_designs')
            .select('elements')
            .eq('project_id', projectId)
            .maybeSingle()
          if (data?.elements) {
            const migrated = (data.elements as PlacedElement[]).map(el =>
              (el as any).view === 'side' ? { ...el, view: 'side-left' as ViewId } : el
            )
            setElements(migrated)
          }
        } catch { /* empty */ }
      })()
    }
  }, [workOrderId, projectId])

  const freePalette = catalogLoaded && catalogPalette.length > 0 ? catalogPalette : DEFAULT_PALETTE
  const activePalette = isWoMode ? woPalette : freePalette

  const snap = (v: number) => Math.round(v / 50) * 50

  const svgPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }
      const svgPt = pt.matrixTransform(ctm.inverse())
      return { x: svgPt.x, y: svgPt.y }
    }, [],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elId: string) => {
      e.preventDefault()
      e.stopPropagation()
      const el = elements.find(p => p.id === elId)
      if (!el) return
      const pt = svgPoint(e.clientX, e.clientY)
      setDragging({ id: elId, offsetX: pt.x - el.x, offsetY: pt.y - el.y })
      setSelected(elId)
    }, [elements, svgPoint],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      const pt = svgPoint(e.clientX, e.clientY)
      setElements(prev =>
        prev.map(el => {
          if (el.id !== dragging.id) return el
          const raw = { x: snap(pt.x - dragging.offsetX), y: snap(pt.y - dragging.offsetY) }
          const clamped = clamp(raw.x, raw.y, el.w, el.h, el.view, van)
          return { ...el, ...clamped }
        }),
      )
    }, [dragging, svgPoint, van],
  )

  const handleMouseUp = useCallback(() => setDragging(null), [])

  // Add element — auto-switch view if element has a preferred one
  const addElement = (tpl: ExteriorElement) => {
    const targetView = tpl.preferredView ?? activeView
    if (tpl.preferredView && tpl.preferredView !== activeView) {
      setActiveView(tpl.preferredView)
      toast(`Vista cambiada a ${views.find(v => v.id === tpl.preferredView)?.label ?? tpl.preferredView}`, { icon: '🔄' })
    }
    const vc = views.find(v => v.id === targetView)!
    const rawX = snap(vc.svgW / 2 - tpl.w / 2)
    const rawY = snap(vc.svgH / 2 - tpl.h / 2)
    const clamped = clamp(rawX, rawY, tpl.w, tpl.h, targetView, van)
    const placed: PlacedElement = {
      ...tpl,
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...clamped,
      view: targetView,
      rotation: 0,
    }
    setElements(prev => [...prev, placed])
    setSelected(placed.id)
    toast.success(`${tpl.label} añadido`)
  }

  const deleteSelected = () => {
    if (!selected) return
    setElements(prev => prev.filter(e => e.id !== selected))
    setSelected(null)
  }

  const rotateSelected = () => {
    if (!selected) return
    setElements(prev =>
      prev.map(el => {
        if (el.id !== selected) return el
        const rotated = { ...el, rotation: (el.rotation + 90) % 360, w: el.h, h: el.w }
        const clamped = clamp(rotated.x, rotated.y, rotated.w, rotated.h, rotated.view, van)
        return { ...rotated, ...clamped }
      }),
    )
  }

  const duplicateSelected = () => {
    const src = elements.find(e => e.id === selected)
    if (!src) return
    const dup: PlacedElement = {
      ...src,
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: src.x + 100,
      y: src.y + 100,
    }
    const clamped = clamp(dup.x, dup.y, dup.w, dup.h, dup.view, van)
    setElements(prev => [...prev, { ...dup, ...clamped }])
    setSelected(dup.id)
  }

  const save = async () => {
    const effectiveWoId = workOrderId || linkedWO?.id
    if (!effectiveWoId && !projectId && !linkedPP) {
      toast.error('Vincula una orden de trabajo o guarda desde un proyecto')
      return
    }
    setSaving(true)
    try {
      if (effectiveWoId) {
        const { data: existing } = await supabase
          .from('exterior_designs')
          .select('id')
          .eq('work_order_id', effectiveWoId)
          .maybeSingle()
        if (existing) {
          await supabase
            .from('exterior_designs')
            .update({ elements, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          const wo = workOrder || linkedWO
          await supabase
            .from('exterior_designs')
            .insert({ work_order_id: effectiveWoId, project_id: wo?.project_id, elements })
        }
        const wo = workOrder || linkedWO
        if (wo) {
          const updatedItems = (wo.items as FurnitureWorkOrderItem[]).map(item => ({
            ...item,
            designStatus: elements.some(el => el.fromQuote) ? 'designed' as const : item.designStatus,
          }))
          await FurnitureWorkOrderService.updateItems(wo.id, updatedItems)
        }
      } else if (linkedPP) {
        const { data: existing } = await supabase
          .from('exterior_designs')
          .select('id')
          .eq('production_project_id', linkedPP.id)
          .maybeSingle()
        if (existing) {
          await supabase
            .from('exterior_designs')
            .update({ elements, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('exterior_designs')
            .insert({ production_project_id: linkedPP.id, elements })
        }
      } else {
        await supabase
          .from('exterior_designs')
          .upsert({ project_id: projectId, elements, updated_at: new Date().toISOString() })
      }
      toast.success('Diseño exterior guardado')
    } catch (err: any) {
      toast.error('Error guardando: ' + (err.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  const viewElements = useMemo(
    () => elements.filter(e => e.view === activeView),
    [elements, activeView],
  )

  const selectedEl = elements.find(e => e.id === selected)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(isWoMode ? '/design/exterior' : '/design')}
            className="text-sm text-blue-600 hover:underline">← {isWoMode ? 'Órdenes' : 'Diseño'}</button>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              🚐 Diseño Exterior
            </h1>
            {workOrder ? (
              <p className="text-xs text-slate-500 mt-0.5">
                📋 {workOrder.quote_number} · {workOrder.client_name} · {(workOrder.items ?? []).length} elementos
              </p>
            ) : linkedWO ? (
              <p className="text-xs text-slate-500 mt-0.5">
                🔗 OT: {linkedWO.quote_number} · {linkedWO.client_name}
              </p>
            ) : linkedPP ? (
              <p className="text-xs text-slate-500 mt-0.5">
                🏭 Producción: {linkedPP.quote_number} · {linkedPP.client_name}
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">
                Coloca ventanas, claraboyas, aireadores y demás elementos en la furgoneta
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {/* WO linking for free mode */}
          {!isWoMode && (
            <div className="relative">
              <button onClick={() => setShowWOSelector(!showWOSelector)}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                  linkedWO || linkedPP
                    ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                    : 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                }`}>
                {linkedWO ? `🔗 ${linkedWO.quote_number}` : linkedPP ? `🏭 ${linkedPP.quote_number}` : '📋 Vincular'}
              </button>
              {showWOSelector && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-72 overflow-hidden flex flex-col">
                  {/* Tabs */}
                  <div className="flex border-b border-slate-100">
                    <button onClick={() => setLinkTab('design')}
                      className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase ${linkTab === 'design' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>
                      📋 OT Diseño
                    </button>
                    <button onClick={() => setLinkTab('production')}
                      className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase ${linkTab === 'production' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-400'}`}>
                      🏭 Producción
                    </button>
                  </div>
                  {(linkedWO || linkedPP) && (
                    <button onClick={() => { setLinkedWO(null); setLinkedPP(null); setShowWOSelector(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-b border-slate-100">
                      ✕ Desvincular
                    </button>
                  )}
                  <div className="overflow-y-auto max-h-52">
                    {linkTab === 'design' ? (
                      availableWOs.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No hay órdenes de diseño exterior</p>
                      ) : (
                        availableWOs.map(wo => (
                          <button key={wo.id} onClick={() => { setLinkedWO(wo); setLinkedPP(null); setShowWOSelector(false); toast.success(`Vinculado a OT ${wo.quote_number}`) }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 ${linkedWO?.id === wo.id ? 'bg-green-50' : ''}`}>
                            <p className="font-bold text-slate-700">{wo.quote_number}</p>
                            <p className="text-[10px] text-slate-400">{wo.client_name} · {(wo.items ?? []).length} items</p>
                          </button>
                        ))
                      )
                    ) : (
                      availablePPs.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No hay proyectos de producción</p>
                      ) : (
                        availablePPs.map(pp => (
                          <button key={pp.id} onClick={() => { setLinkedPP(pp); setLinkedWO(null); setShowWOSelector(false); toast.success(`Vinculado a producción ${pp.quote_number}`) }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 ${linkedPP?.id === pp.id ? 'bg-violet-50' : ''}`}>
                            <p className="font-bold text-slate-700">{pp.quote_number}</p>
                            <p className="text-[10px] text-slate-400">{pp.client_name} · {pp.status}</p>
                          </button>
                        ))
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {(workOrderId || projectId || linkedWO || linkedPP) && (
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
              {saving ? '⏳ Guardando…' : '💾 Guardar'}
            </button>
          )}
        </div>
      </div>

      <VanConfigPanel config={van} preset={preset}
        onPreset={handlePreset} onChange={handleVanChange} />

      {/* View selector + cotas toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          {views.map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)}
              className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                activeView === v.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCotas(!showCotas)}
          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
            showCotas ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}>
          📏 Cotas {showCotas ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        {/* ── Canvas ──────────────────────────────────────── */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 overflow-auto shadow-sm">
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`-120 -120 ${viewConfig.svgW + 240} ${viewConfig.svgH + 300}`}
            className="bg-white rounded-xl cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelected(null)}
          >
            <CotaMarkers />

            {activeView === 'side-left' && <VanSideLeftSVG van={van} key="side-left" />}
            {activeView === 'side-right' && <VanSideRightSVG van={van} key="side-right" />}
            {activeView === 'top' && <VanTopSVG van={van} key="top" />}
            {activeView === 'rear' && <VanRearSVG van={van} key="rear" />}

            {/* Placed elements with symbols */}
            {viewElements.map(el => {
              const isSelected = el.id === selected
              const vis = ELEMENT_VISUALS[el.type] ?? ELEMENT_VISUALS.custom
              return (
                <g key={el.id}
                  onMouseDown={e => handleMouseDown(e, el.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: 'grab' }}
                >
                  {/* Type-specific visual symbol */}
                  <ElementSymbol el={el} isSelected={isSelected} />

                  {/* Short type label at top-left corner */}
                  <rect x={el.x + 6} y={el.y + 6} width={Math.max(36, vis.shortLabel.length * 20 + 12)} height={30}
                    rx={4} fill={vis.strokeStyle} fillOpacity={0.85} />
                  <text x={el.x + 10 + Math.max(36, vis.shortLabel.length * 20 + 12) / 2 - 4} y={el.y + 26}
                    textAnchor="middle" fontSize="22" fill="white" fontWeight="800" fontFamily="Arial"
                    style={{ pointerEvents: 'none' }}>
                    {vis.shortLabel}
                  </text>

                  {/* Dimension label in center */}
                  <text x={el.x + el.w / 2} y={el.y + el.h / 2 + 8}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(42, Math.max(18, el.w / 8))}
                    fill={vis.strokeStyle} fontWeight="600" fontFamily="Arial"
                    style={{ pointerEvents: 'none', opacity: 0.8 }}>
                    {el.w}×{el.h}
                  </text>

                  {/* Placement cotas */}
                  {showCotas && isSelected && <PlacementCotas el={el} van={van} />}
                </g>
              )
            })}
          </svg>

          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>
              {viewElements.length} elemento{viewElements.length !== 1 ? 's' : ''} en esta vista ·{' '}
              {elements.length} total
            </span>
            <span>Cuadrícula: 50 mm · Cotas al seleccionar</span>
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Selected properties */}
          {selectedEl && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <LegendMiniSymbol type={selectedEl.type} />
                <span className="truncate">{selectedEl.label}</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-0.5">X (mm)</label>
                  <input type="number" value={selectedEl.x} step={50}
                    onChange={e => {
                      const c = clamp(+e.target.value, selectedEl.y, selectedEl.w, selectedEl.h, selectedEl.view, van)
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, x: c.x } : el))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Y (mm)</label>
                  <input type="number" value={selectedEl.y} step={50}
                    onChange={e => {
                      const c = clamp(selectedEl.x, +e.target.value, selectedEl.w, selectedEl.h, selectedEl.view, van)
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, y: c.y } : el))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Ancho (mm)</label>
                  <input type="number" value={selectedEl.w} step={10}
                    onChange={e => {
                      const nw = +e.target.value
                      const c = clamp(selectedEl.x, selectedEl.y, nw, selectedEl.h, selectedEl.view, van)
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, w: nw, ...c } : el))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Alto (mm)</label>
                  <input type="number" value={selectedEl.h} step={10}
                    onChange={e => {
                      const nh = +e.target.value
                      const c = clamp(selectedEl.x, selectedEl.y, selectedEl.w, nh, selectedEl.view, van)
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, h: nh, ...c } : el))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
              </div>
              {/* Distance readout */}
              <div className="bg-rose-50 rounded-lg px-3 py-2 text-[10px] text-rose-600 font-mono">
                {(selectedEl.view === 'side-left' || selectedEl.view === 'side-right') && (
                  <>
                    <p>↔ Desde inicio carga: <b>{selectedEl.x - van.bodyStart} mm</b></p>
                    <p>↕ Desde suelo: <b>{van.height - (selectedEl.y + selectedEl.h)} mm</b></p>
                  </>
                )}
                {selectedEl.view === 'top' && (
                  <>
                    <p>↔ Desde inicio carga: <b>{selectedEl.x - van.bodyStart} mm</b></p>
                    <p>↕ Desde borde izq: <b>{selectedEl.y - 60} mm</b></p>
                  </>
                )}
                {selectedEl.view === 'rear' && (
                  <>
                    <p>↔ Desde borde izq: <b>{selectedEl.x - 80} mm</b></p>
                    <p>↕ Desde suelo: <b>{van.height - (selectedEl.y + selectedEl.h)} mm</b></p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={rotateSelected}
                  className="py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100">
                  ↻ Rotar
                </button>
                <button onClick={duplicateSelected}
                  className="py-1.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-100">
                  📋 Duplicar
                </button>
                <button onClick={deleteSelected}
                  className="py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100">
                  🗑 Eliminar
                </button>
              </div>
            </div>
          )}

          {/* Palette */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              {isWoMode ? '📋 Elementos del presupuesto' : '🧩 Elementos exteriores (catálogo)'}
              <span className="text-[10px] text-slate-400 ml-2 font-normal">{activePalette.length} elementos</span>
            </h3>
            {activePalette.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No hay elementos exteriores en {isWoMode ? 'esta orden' : 'el catálogo'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {activePalette.map(tpl => {
                  const vis = ELEMENT_VISUALS[tpl.type] ?? ELEMENT_VISUALS.custom
                  return (
                    <button key={tpl.id} onClick={() => addElement(tpl)}
                      className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-xs">
                      <LegendMiniSymbol type={tpl.type} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-700 truncate">{tpl.label}</p>
                        <p className="text-[10px] text-slate-400">{tpl.w}×{tpl.h} mm
                          {tpl.preferredView && <span className="ml-1 text-violet-400">→ {tpl.preferredView === 'top' ? 'techo' : tpl.preferredView === 'rear' ? 'trasero' : 'lateral'}</span>}
                        </p>
                      </div>
                      {tpl.fromQuote && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold flex-shrink-0">
                          PRESU
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Summary per view */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-[10px] space-y-1">
            <p className="font-bold text-slate-600 text-xs mb-1">📊 Resumen por vista</p>
            {views.map(v => {
              const count = elements.filter(e => e.view === v.id).length
              return (
                <p key={v.id} className="text-slate-500 flex justify-between">
                  <span>{v.icon} {v.label}</span>
                  <span className="font-bold">{count}</span>
                </p>
              )
            })}
          </div>

          {/* Symbol legend */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 mb-2">📖 Leyenda de símbolos</h3>
            <div className="space-y-1.5">
              {LEGEND_ITEMS.map(item => (
                <div key={item.type} className="flex items-center gap-2 text-[10px]">
                  <LegendMiniSymbol type={item.type} />
                  <div>
                    <span className="font-bold text-slate-700">{item.label}</span>
                    <span className="text-slate-400 ml-1">— {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-600 text-xs">💡 Instrucciones</p>
            <p>• Paneles solares y claraboyas se añaden al <b>techo</b></p>
            <p>• Portabicis se añade a la vista <b>trasera</b></p>
            <p>• <span className="text-rose-500 font-bold">Cotas rojas</span> al seleccionar: distancia desde inicio carga y suelo</p>
            <p>• Arrastra para mover (acotado al cuerpo)</p>
            <p>• Cuadrícula: 50 mm</p>
          </div>
        </div>
      </div>
    </div>
  )
}
