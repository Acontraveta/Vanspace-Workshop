// ── Van Interior Design ────────────────────────────────────────────
// Floor plan of a van where users can:
// 1) Place furniture items with real dimensions
// 2) Draw electrical diagram (batteries, fusebox, lights, sockets)
// 3) Draw water/plumbing diagram (tank, pump, heater, taps, piping)
//
// Van size is configurable via presets or custom dimensions.
// Floor dimensions derive from the van body config.
// Items are constrained to the floor area.
//
// WO-driven mode: only quote items. Free mode: full default palettes.

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

// ── Floor dimensions derived from van config ─────────────────────
function getFloor(van: VanConfig) {
  return {
    length: van.bodyLength,               // cargo area length
    width: van.width - 280,               // interior width (walls ~140mm each side)
    wallThickness: 40,
    cabinDepth: 400,                      // space for cab seats reference
  }
}

// ── Item types ────────────────────────────────────────────────────
type DiagramLayer = 'furniture' | 'electrical' | 'water'

export interface InteriorItem {
  id: string
  layer: DiagramLayer
  type: string
  label: string
  w: number
  h: number
  x: number
  y: number
  rotation: number
  color: string
  icon: string
  fromQuote?: boolean
  quoteItemName?: string
}

// ── Palette definitions (real product dimensions, mm) ────────────
interface PaletteItem {
  type: string
  label: string
  w: number
  h: number
  color: string
  icon: string
  layer: DiagramLayer
}

// Furniture — top-down: length × depth (as seen from above)
const FURNITURE_PALETTE: PaletteItem[] = [
  { type: 'cama_trans', label: 'Cama transversal', w: 1900, h: 1300, color: '#8b5cf6', icon: '🛏️', layer: 'furniture' },
  { type: 'cama_long', label: 'Cama longitudinal', w: 1900, h: 700, color: '#8b5cf6', icon: '🛏️', layer: 'furniture' },
  { type: 'armario', label: 'Armario columna', w: 600, h: 450, color: '#a855f7', icon: '🗄️', layer: 'furniture' },
  { type: 'cocina', label: 'Bloque cocina', w: 1200, h: 550, color: '#f97316', icon: '🍳', layer: 'furniture' },
  { type: 'cocina_sm', label: 'Cocina compacta', w: 800, h: 500, color: '#f97316', icon: '🍳', layer: 'furniture' },
  { type: 'mesa', label: 'Mesa plegable', w: 600, h: 400, color: '#eab308', icon: '🪵', layer: 'furniture' },
  { type: 'nevera', label: 'Nevera compresor', w: 525, h: 380, color: '#06b6d4', icon: '❄️', layer: 'furniture' },
  { type: 'nevera_top', label: 'Nevera top-load', w: 650, h: 400, color: '#06b6d4', icon: '❄️', layer: 'furniture' },
  { type: 'asiento', label: 'Asiento giratorio', w: 500, h: 460, color: '#64748b', icon: '💺', layer: 'furniture' },
  { type: 'bano', label: 'Baño/ducha', w: 800, h: 700, color: '#0ea5e9', icon: '🚿', layer: 'furniture' },
  { type: 'almacenaje', label: 'Almacenaje bajo', w: 600, h: 400, color: '#78716c', icon: '📦', layer: 'furniture' },
  { type: 'banco', label: 'Banco con cofre', w: 1100, h: 450, color: '#92400e', icon: '🪑', layer: 'furniture' },
]

const ELECTRICAL_PALETTE: PaletteItem[] = [
  { type: 'bateria', label: 'Batería AGM 12V', w: 330, h: 175, color: '#dc2626', icon: '🔋', layer: 'electrical' },
  { type: 'bateria_litio', label: 'Batería LiFePO4', w: 325, h: 175, color: '#dc2626', icon: '⚡', layer: 'electrical' },
  { type: 'fusiblera', label: 'Fusiblera', w: 200, h: 100, color: '#f59e0b', icon: '🔌', layer: 'electrical' },
  { type: 'inversor', label: 'Inversor 12V→220V', w: 260, h: 160, color: '#f97316', icon: '🔄', layer: 'electrical' },
  { type: 'regulador_solar', label: 'Regulador solar MPPT', w: 190, h: 130, color: '#16a34a', icon: '☀️', layer: 'electrical' },
  { type: 'enchufe_220', label: 'Enchufe 220V', w: 80, h: 80, color: '#3b82f6', icon: '🔌', layer: 'electrical' },
  { type: 'enchufe_usb', label: 'Toma USB', w: 80, h: 60, color: '#6366f1', icon: '🔌', layer: 'electrical' },
  { type: 'enchufe_12v', label: 'Toma 12V', w: 80, h: 80, color: '#0ea5e9', icon: '🔌', layer: 'electrical' },
  { type: 'luz_led', label: 'Tira LED', w: 400, h: 30, color: '#eab308', icon: '💡', layer: 'electrical' },
  { type: 'luz_foco', label: 'Foco LED', w: 80, h: 80, color: '#eab308', icon: '💡', layer: 'electrical' },
  { type: 'interruptor', label: 'Interruptor', w: 80, h: 60, color: '#475569', icon: '🔘', layer: 'electrical' },
  { type: 'panel_control', label: 'Panel de control', w: 200, h: 120, color: '#334155', icon: '📊', layer: 'electrical' },
]

const WATER_PALETTE: PaletteItem[] = [
  { type: 'deposito_limpia', label: 'Depósito agua limpia', w: 500, h: 300, color: '#3b82f6', icon: '💧', layer: 'water' },
  { type: 'deposito_gris', label: 'Depósito agua gris', w: 500, h: 300, color: '#6b7280', icon: '🚰', layer: 'water' },
  { type: 'bomba', label: 'Bomba de agua', w: 150, h: 100, color: '#0ea5e9', icon: '⚙️', layer: 'water' },
  { type: 'calentador', label: 'Calentador (boiler)', w: 250, h: 200, color: '#ef4444', icon: '🔥', layer: 'water' },
  { type: 'grifo_cocina', label: 'Grifo cocina', w: 80, h: 80, color: '#06b6d4', icon: '🚰', layer: 'water' },
  { type: 'grifo_ducha', label: 'Grifo ducha', w: 80, h: 80, color: '#06b6d4', icon: '🚿', layer: 'water' },
  { type: 'filtro', label: 'Filtro de agua', w: 120, h: 80, color: '#14b8a6', icon: '🧪', layer: 'water' },
  { type: 'desague', label: 'Desagüe', w: 80, h: 80, color: '#78716c', icon: '⬇️', layer: 'water' },
  { type: 'tuberia_fria', label: 'Tubería fría (tramo)', w: 400, h: 25, color: '#3b82f6', icon: '〰️', layer: 'water' },
  { type: 'tuberia_caliente', label: 'Tubería caliente (tramo)', w: 400, h: 25, color: '#ef4444', icon: '〰️', layer: 'water' },
]

const LAYER_CONFIG: Record<DiagramLayer, { label: string; icon: string; color: string; palette: PaletteItem[] }> = {
  furniture: { label: 'Muebles', icon: '🪑', color: '#8b5cf6', palette: FURNITURE_PALETTE },
  electrical: { label: 'Eléctrico', icon: '⚡', color: '#f59e0b', palette: ELECTRICAL_PALETTE },
  water: { label: 'Agua', icon: '💧', color: '#3b82f6', palette: WATER_PALETTE },
}

// ── Helpers: map quote item names to interior palette items ──────
const INTERIOR_TYPE_MAP: { keywords: string[]; type: string; layer: DiagramLayer; color: string; icon: string; defaultW: number; defaultH: number }[] = [
  // Furniture
  { keywords: ['cama transversal'], type: 'cama_trans', layer: 'furniture', color: '#8b5cf6', icon: '🛏️', defaultW: 1900, defaultH: 1300 },
  { keywords: ['cama longitudinal'], type: 'cama_long', layer: 'furniture', color: '#8b5cf6', icon: '🛏️', defaultW: 1900, defaultH: 700 },
  { keywords: ['cama'], type: 'cama_trans', layer: 'furniture', color: '#8b5cf6', icon: '🛏️', defaultW: 1900, defaultH: 1300 },
  { keywords: ['armario'], type: 'armario', layer: 'furniture', color: '#a855f7', icon: '🗄️', defaultW: 600, defaultH: 450 },
  { keywords: ['cocina'], type: 'cocina', layer: 'furniture', color: '#f97316', icon: '🍳', defaultW: 1200, defaultH: 550 },
  { keywords: ['mesa'], type: 'mesa', layer: 'furniture', color: '#eab308', icon: '🪵', defaultW: 600, defaultH: 400 },
  { keywords: ['nevera', 'frigorífico'], type: 'nevera', layer: 'furniture', color: '#06b6d4', icon: '❄️', defaultW: 525, defaultH: 380 },
  { keywords: ['asiento', 'silla'], type: 'asiento', layer: 'furniture', color: '#64748b', icon: '💺', defaultW: 500, defaultH: 460 },
  { keywords: ['baño', 'ducha'], type: 'bano', layer: 'furniture', color: '#0ea5e9', icon: '🚿', defaultW: 800, defaultH: 700 },
  { keywords: ['almacenaje', 'cajón'], type: 'almacenaje', layer: 'furniture', color: '#78716c', icon: '📦', defaultW: 600, defaultH: 400 },
  { keywords: ['banco'], type: 'banco', layer: 'furniture', color: '#92400e', icon: '🪑', defaultW: 1100, defaultH: 450 },
  // Electrical
  { keywords: ['batería', 'bateria'], type: 'bateria', layer: 'electrical', color: '#dc2626', icon: '🔋', defaultW: 330, defaultH: 175 },
  { keywords: ['fusiblera', 'fusible'], type: 'fusiblera', layer: 'electrical', color: '#f59e0b', icon: '🔌', defaultW: 200, defaultH: 100 },
  { keywords: ['inversor'], type: 'inversor', layer: 'electrical', color: '#f97316', icon: '🔄', defaultW: 260, defaultH: 160 },
  { keywords: ['regulador solar'], type: 'regulador_solar', layer: 'electrical', color: '#16a34a', icon: '☀️', defaultW: 190, defaultH: 130 },
  { keywords: ['enchufe 220', '220v'], type: 'enchufe_220', layer: 'electrical', color: '#3b82f6', icon: '🔌', defaultW: 80, defaultH: 80 },
  { keywords: ['usb'], type: 'enchufe_usb', layer: 'electrical', color: '#6366f1', icon: '🔌', defaultW: 80, defaultH: 60 },
  { keywords: ['12v'], type: 'enchufe_12v', layer: 'electrical', color: '#0ea5e9', icon: '🔌', defaultW: 80, defaultH: 80 },
  { keywords: ['tira led', 'tira'], type: 'luz_led', layer: 'electrical', color: '#eab308', icon: '💡', defaultW: 400, defaultH: 30 },
  { keywords: ['foco'], type: 'luz_foco', layer: 'electrical', color: '#eab308', icon: '💡', defaultW: 80, defaultH: 80 },
  { keywords: ['interruptor'], type: 'interruptor', layer: 'electrical', color: '#475569', icon: '🔘', defaultW: 80, defaultH: 60 },
  { keywords: ['panel control', 'panel'], type: 'panel_control', layer: 'electrical', color: '#334155', icon: '📊', defaultW: 200, defaultH: 120 },
  // Water
  { keywords: ['depósito limpia', 'deposito limpia', 'agua limpia'], type: 'deposito_limpia', layer: 'water', color: '#3b82f6', icon: '💧', defaultW: 500, defaultH: 300 },
  { keywords: ['depósito gris', 'deposito gris', 'agua gris'], type: 'deposito_gris', layer: 'water', color: '#6b7280', icon: '🚰', defaultW: 500, defaultH: 300 },
  { keywords: ['bomba'], type: 'bomba', layer: 'water', color: '#0ea5e9', icon: '⚙️', defaultW: 150, defaultH: 100 },
  { keywords: ['calentador', 'boiler'], type: 'calentador', layer: 'water', color: '#ef4444', icon: '🔥', defaultW: 250, defaultH: 200 },
  { keywords: ['grifo cocina'], type: 'grifo_cocina', layer: 'water', color: '#06b6d4', icon: '🚰', defaultW: 80, defaultH: 80 },
  { keywords: ['grifo ducha'], type: 'grifo_ducha', layer: 'water', color: '#06b6d4', icon: '🚿', defaultW: 80, defaultH: 80 },
  { keywords: ['filtro'], type: 'filtro', layer: 'water', color: '#14b8a6', icon: '🧪', defaultW: 120, defaultH: 80 },
  { keywords: ['desagüe', 'desague'], type: 'desague', layer: 'water', color: '#78716c', icon: '⬇️', defaultW: 80, defaultH: 80 },
]

// Determine layer from FAMILIA string
function familiaToLayer(familia?: string): DiagramLayer | null {
  if (!familia) return null
  const f = familia.toLowerCase()
  if (f.includes('electric') || f.includes('electri')) return 'electrical'
  if (f.includes('fontaner') || f.includes('agua') || f.includes('water')) return 'water'
  if (f.includes('mueble') || f.includes('mobiliario') || f.includes('furniture')) return 'furniture'
  // ventanas, accesorios, etc. → furniture by default
  return 'furniture'
}

const LAYER_DEFAULTS: Record<DiagramLayer, { color: string; icon: string }> = {
  furniture:  { color: '#64748b', icon: '📦' },
  electrical: { color: '#f59e0b', icon: '⚡' },
  water:      { color: '#3b82f6', icon: '💧' },
}

function quoteItemToInteriorPalette(item: FurnitureWorkOrderItem, idx: number): PaletteItem & { fromQuote: true } {
  const nameLower = item.quoteItemName.toLowerCase()
  const dimMatch = nameLower.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/)
  const parsedW = dimMatch ? parseInt(dimMatch[1]) : undefined
  const parsedH = dimMatch ? parseInt(dimMatch[2]) : undefined

  // 1. Determine layer from FAMILIA (primary) or keyword match (fallback)
  const familiaLayer = familiaToLayer(item.familia)

  // 2. Try keyword match for visual type (icon, dimensions, color)
  for (const mapping of INTERIOR_TYPE_MAP) {
    if (mapping.keywords.some(k => nameLower.includes(k))) {
      return {
        type: mapping.type,
        label: item.quoteItemName,
        w: parsedW ?? mapping.defaultW,
        h: parsedH ?? mapping.defaultH,
        color: mapping.color,
        icon: mapping.icon,
        layer: familiaLayer ?? mapping.layer,  // FAMILIA wins over keyword
        fromQuote: true,
      }
    }
  }

  // 3. No keyword match — use FAMILIA for layer, generic appearance
  const layer = familiaLayer ?? 'furniture'
  const defaults = LAYER_DEFAULTS[layer]
  return {
    type: 'custom',
    label: item.quoteItemName,
    w: parsedW ?? 400,
    h: parsedH ?? 300,
    color: defaults.color,
    icon: defaults.icon,
    layer,
    fromQuote: true,
  }
}

// ── Map catalog product → PaletteItem (for free mode) ────────────
function catalogToInteriorPalette(p: CatalogProduct): PaletteItem | null {
  const nameLower = (p.NOMBRE || '').toLowerCase()
  const famLower = (p.FAMILIA || '').toLowerCase()
  const catLower = (p.CATEGORIA || '').toLowerCase()
  const all = `${nameLower} ${famLower} ${catLower}`

  // Attempt dimension extraction from name
  const dimMatch = nameLower.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/)
  const parsedW = dimMatch ? parseInt(dimMatch[1]) : undefined
  const parsedH = dimMatch ? parseInt(dimMatch[2]) : undefined

  // 1. Determine layer from FAMILIA (primary source of truth)
  const familiaLayer = familiaToLayer(p.FAMILIA)

  // 2. Try keyword match for visual type (icon, size, color)
  for (const mapping of INTERIOR_TYPE_MAP) {
    if (mapping.keywords.some(k => all.includes(k))) {
      return {
        type: mapping.type,
        label: p.NOMBRE,
        w: parsedW ?? mapping.defaultW,
        h: parsedH ?? mapping.defaultH,
        color: mapping.color,
        icon: mapping.icon,
        layer: familiaLayer ?? mapping.layer,  // FAMILIA wins over keyword
      }
    }
  }

  // 3. No keyword match but has a valid FAMILIA → show with generic appearance
  if (familiaLayer) {
    const defaults = LAYER_DEFAULTS[familiaLayer]
    return {
      type: 'custom',
      label: p.NOMBRE,
      w: parsedW ?? 300,
      h: parsedH ?? 200,
      color: defaults.color,
      icon: defaults.icon,
      layer: familiaLayer,
    }
  }

  return null // no FAMILIA and no keyword match → skip
}

// ── SVG Symbol visuals per type ───────────────────────────────────
interface ItemVisual {
  shortLabel: string
  strokeStyle: string
}

const INTERIOR_VISUALS: Record<string, ItemVisual> = {
  // Furniture
  cama_trans:      { shortLabel: 'CT', strokeStyle: '#8b5cf6' },
  cama_long:       { shortLabel: 'CL', strokeStyle: '#8b5cf6' },
  armario:         { shortLabel: 'AR', strokeStyle: '#a855f7' },
  cocina:          { shortLabel: 'CO', strokeStyle: '#f97316' },
  cocina_sm:       { shortLabel: 'CO', strokeStyle: '#f97316' },
  mesa:            { shortLabel: 'ME', strokeStyle: '#eab308' },
  nevera:          { shortLabel: 'NV', strokeStyle: '#06b6d4' },
  nevera_top:      { shortLabel: 'NV', strokeStyle: '#06b6d4' },
  asiento:         { shortLabel: 'AS', strokeStyle: '#64748b' },
  bano:            { shortLabel: 'BA', strokeStyle: '#0ea5e9' },
  almacenaje:      { shortLabel: 'AL', strokeStyle: '#78716c' },
  banco:           { shortLabel: 'BN', strokeStyle: '#92400e' },
  // Electrical
  bateria:         { shortLabel: 'BT', strokeStyle: '#dc2626' },
  bateria_litio:   { shortLabel: 'Li', strokeStyle: '#dc2626' },
  fusiblera:       { shortLabel: 'FU', strokeStyle: '#f59e0b' },
  inversor:        { shortLabel: 'IN', strokeStyle: '#f97316' },
  regulador_solar: { shortLabel: 'MP', strokeStyle: '#16a34a' },
  enchufe_220:     { shortLabel: '220', strokeStyle: '#3b82f6' },
  enchufe_usb:     { shortLabel: 'USB', strokeStyle: '#6366f1' },
  enchufe_12v:     { shortLabel: '12V', strokeStyle: '#0ea5e9' },
  luz_led:         { shortLabel: 'LED', strokeStyle: '#eab308' },
  luz_foco:        { shortLabel: 'FO', strokeStyle: '#eab308' },
  interruptor:     { shortLabel: 'SW', strokeStyle: '#475569' },
  panel_control:   { shortLabel: 'PC', strokeStyle: '#334155' },
  // Water
  deposito_limpia: { shortLabel: 'DL', strokeStyle: '#3b82f6' },
  deposito_gris:   { shortLabel: 'DG', strokeStyle: '#6b7280' },
  bomba:           { shortLabel: 'BO', strokeStyle: '#0ea5e9' },
  calentador:      { shortLabel: 'CA', strokeStyle: '#ef4444' },
  grifo_cocina:    { shortLabel: 'GC', strokeStyle: '#06b6d4' },
  grifo_ducha:     { shortLabel: 'GD', strokeStyle: '#06b6d4' },
  filtro:          { shortLabel: 'FI', strokeStyle: '#14b8a6' },
  desague:         { shortLabel: 'DA', strokeStyle: '#78716c' },
  tuberia_fria:    { shortLabel: '~F', strokeStyle: '#3b82f6' },
  tuberia_caliente:{ shortLabel: '~C', strokeStyle: '#ef4444' },
  custom:          { shortLabel: '?',  strokeStyle: '#64748b' },
}

// ── SVG Symbol drawings per interior type ─────────────────────────
function InteriorItemSymbol({ item, isSelected }: { item: InteriorItem; isSelected: boolean }) {
  const vis = INTERIOR_VISUALS[item.type] ?? INTERIOR_VISUALS.custom
  const selStroke = isSelected ? '#f43f5e' : vis.strokeStyle
  const selWidth = isSelected ? 6 : 3
  const selDash = isSelected ? '12,4' : 'none'
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2

  // Layer-specific dash
  const layerDash = item.layer === 'water' ? '8,4' : item.layer === 'electrical' ? '4,4' : 'none'
  const dash = isSelected ? selDash : layerDash

  switch (item.type) {
    // ── Furniture ──────────────────────────────────
    case 'cama_trans':
    case 'cama_long':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={10}
            fill="#ede9fe60" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Pillow */}
          <rect x={item.x + 20} y={item.y + 20} width={Math.min(300, item.w * 0.3)} height={item.h - 40}
            rx={20} fill="#c4b5fd40" stroke="#8b5cf640" strokeWidth="3" />
          {/* Blanket lines */}
          {[0.5, 0.65, 0.8].map(f => (
            <line key={f} x1={item.x + item.w * f} y1={item.y + 15}
              x2={item.x + item.w * f} y2={item.y + item.h - 15}
              stroke="#8b5cf625" strokeWidth="4" />
          ))}
        </g>
      )

    case 'armario':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#f3e8ff40" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Door split */}
          <line x1={cx} y1={item.y + 10} x2={cx} y2={item.y + item.h - 10}
            stroke="#a855f740" strokeWidth="3" />
          {/* Handle dots */}
          <circle cx={cx - 20} cy={cy} r={6} fill="#a855f750" />
          <circle cx={cx + 20} cy={cy} r={6} fill="#a855f750" />
        </g>
      )

    case 'cocina':
    case 'cocina_sm':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#fff7ed40" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Hob circles */}
          {[0.3, 0.7].map(fx => [0.35, 0.65].map(fy => (
            <circle key={`${fx}-${fy}`}
              cx={item.x + item.w * fx} cy={item.y + item.h * fy}
              r={Math.min(item.w, item.h) * 0.1}
              fill="none" stroke="#f9731650" strokeWidth="3" />
          )))}
          {/* Sink rectangle */}
          <rect x={item.x + item.w * 0.75} y={item.y + item.h * 0.2}
            width={item.w * 0.18} height={item.h * 0.6}
            rx={6} fill="none" stroke="#06b6d440" strokeWidth="3" />
        </g>
      )

    case 'mesa':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={8}
            fill="#fefce840" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Cross brace pattern */}
          <line x1={item.x + 15} y1={item.y + 15} x2={item.x + item.w - 15} y2={item.y + item.h - 15}
            stroke="#eab30820" strokeWidth="3" />
          <line x1={item.x + item.w - 15} y1={item.y + 15} x2={item.x + 15} y2={item.y + item.h - 15}
            stroke="#eab30820" strokeWidth="3" />
        </g>
      )

    case 'nevera':
    case 'nevera_top':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#ecfeff40" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Snowflake hint */}
          <line x1={cx} y1={cy - 30} x2={cx} y2={cy + 30} stroke="#06b6d440" strokeWidth="4" />
          <line x1={cx - 25} y1={cy - 15} x2={cx + 25} y2={cy + 15} stroke="#06b6d440" strokeWidth="3" />
          <line x1={cx + 25} y1={cy - 15} x2={cx - 25} y2={cy + 15} stroke="#06b6d440" strokeWidth="3" />
        </g>
      )

    case 'asiento':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.w * 0.15}
            fill="#f8fafc60" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Seat back curve */}
          <path d={`M ${item.x + 15} ${item.y + item.h * 0.3}
            Q ${cx} ${item.y + 10} ${item.x + item.w - 15} ${item.y + item.h * 0.3}`}
            fill="none" stroke="#64748b40" strokeWidth="4" />
          {/* Rotation arrow */}
          <path d={`M ${cx + 20} ${cy + 20} A 20 20 0 1 1 ${cx - 10} ${cy + 25}`}
            fill="none" stroke="#64748b30" strokeWidth="3" markerEnd="url(#arrowR-int)" />
        </g>
      )

    case 'bano':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={10}
            fill="#e0f2fe30" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Shower tray */}
          <rect x={item.x + 20} y={item.y + 20} width={item.w - 40} height={item.h - 40}
            rx={15} fill="none" stroke="#0ea5e930" strokeWidth="3" strokeDasharray="10,5" />
          {/* Drain */}
          <circle cx={cx} cy={cy + 20} r={15} fill="none" stroke="#0ea5e940" strokeWidth="3" />
          <circle cx={cx} cy={cy + 20} r={5} fill="#0ea5e930" />
        </g>
      )

    case 'almacenaje':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#f5f5f440" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Drawer lines */}
          {[0.33, 0.66].map(f => (
            <line key={f} x1={item.x + 10} y1={item.y + item.h * f}
              x2={item.x + item.w - 10} y2={item.y + item.h * f}
              stroke="#78716c30" strokeWidth="3" />
          ))}
        </g>
      )

    case 'banco':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#fef3c720" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Lid hinge line */}
          <line x1={item.x + 10} y1={item.y + 18}
            x2={item.x + item.w - 10} y2={item.y + 18}
            stroke="#92400e40" strokeWidth="4" />
        </g>
      )

    // ── Electrical ─────────────────────────────────
    case 'bateria':
    case 'bateria_litio':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#fef2f230" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* + / - terminals */}
          <text x={item.x + 20} y={item.y + 30} fontSize="28" fill="#dc262680" fontWeight="900">+</text>
          <text x={item.x + item.w - 35} y={item.y + 30} fontSize="28" fill="#64748b80" fontWeight="900">−</text>
          {/* Cells */}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={item.x + item.w * f} y1={item.y + 10}
              x2={item.x + item.w * f} y2={item.y + item.h - 10}
              stroke="#dc262615" strokeWidth="3" />
          ))}
        </g>
      )

    case 'fusiblera':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={4}
            fill="#fffbeb30" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Fuse slots */}
          {Array.from({ length: Math.min(6, Math.floor(item.w / 30)) }, (_, i) => (
            <rect key={i} x={item.x + 10 + i * (item.w - 20) / 6} y={item.y + item.h * 0.25}
              width={(item.w - 20) / 8} height={item.h * 0.5}
              rx={2} fill="#f59e0b20" stroke="#f59e0b30" strokeWidth="1.5" />
          ))}
        </g>
      )

    case 'inversor':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#fff7ed30" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* AC wave */}
          <path d={`M ${item.x + 20} ${cy}
            Q ${item.x + item.w * 0.3} ${cy - 25} ${cx} ${cy}
            Q ${item.x + item.w * 0.7} ${cy + 25} ${item.x + item.w - 20} ${cy}`}
            fill="none" stroke="#f9731640" strokeWidth="4" />
        </g>
      )

    case 'regulador_solar':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#f0fdf430" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Sun */}
          <circle cx={cx} cy={cy} r={Math.min(item.w, item.h) * 0.18}
            fill="#16a34a15" stroke="#16a34a40" strokeWidth="3" />
          {[0, 45, 90, 135].map(a => {
            const r1 = Math.min(item.w, item.h) * 0.22
            const r2 = Math.min(item.w, item.h) * 0.3
            const rad = (a * Math.PI) / 180
            return <line key={a}
              x1={cx + Math.cos(rad) * r1} y1={cy + Math.sin(rad) * r1}
              x2={cx + Math.cos(rad) * r2} y2={cy + Math.sin(rad) * r2}
              stroke="#16a34a30" strokeWidth="3" />
          })}
        </g>
      )

    case 'enchufe_220':
    case 'enchufe_12v':
    case 'enchufe_usb':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.w * 0.2}
            fill={item.color + '15'} stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Socket holes */}
          <circle cx={cx - 10} cy={cy} r={5} fill={item.color + '40'} />
          <circle cx={cx + 10} cy={cy} r={5} fill={item.color + '40'} />
        </g>
      )

    case 'luz_led':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.h / 2}
            fill="#fefce840" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* LED dots */}
          {Array.from({ length: Math.min(10, Math.floor(item.w / 40)) }, (_, i) => (
            <circle key={i}
              cx={item.x + 20 + i * ((item.w - 40) / Math.max(1, Math.min(9, Math.floor(item.w / 40) - 1)))}
              cy={cy} r={4}
              fill="#eab30860" />
          ))}
        </g>
      )

    case 'luz_foco':
      return (
        <g>
          <circle cx={cx} cy={cy} r={Math.min(item.w, item.h) / 2}
            fill="#fefce830" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Light rays */}
          {[0, 60, 120, 180, 240, 300].map(a => {
            const r1 = Math.min(item.w, item.h) * 0.2
            const r2 = Math.min(item.w, item.h) * 0.38
            const rad = (a * Math.PI) / 180
            return <line key={a}
              x1={cx + Math.cos(rad) * r1} y1={cy + Math.sin(rad) * r1}
              x2={cx + Math.cos(rad) * r2} y2={cy + Math.sin(rad) * r2}
              stroke="#eab30840" strokeWidth="2" />
          })}
        </g>
      )

    case 'interruptor':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#f8fafc60" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Toggle */}
          <rect x={cx - 8} y={item.y + 8} width={16} height={item.h - 16}
            rx={8} fill="#47556920" stroke="#47556930" strokeWidth="2" />
          <circle cx={cx} cy={cy - 8} r={6} fill="#47556950" />
        </g>
      )

    case 'panel_control':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={8}
            fill="#1e293b10" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Screen */}
          <rect x={item.x + 15} y={item.y + 15} width={item.w - 30} height={item.h * 0.5}
            rx={4} fill="#33415520" stroke="#33415520" strokeWidth="2" />
          {/* Buttons */}
          {[0.3, 0.5, 0.7].map(f => (
            <circle key={f} cx={item.x + item.w * f} cy={item.y + item.h * 0.85}
              r={6} fill="#33415520" />
          ))}
        </g>
      )

    // ── Water ──────────────────────────────────────
    case 'deposito_limpia':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={10}
            fill="#dbeafe30" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Water level */}
          <rect x={item.x + 15} y={cy} width={item.w - 30} height={item.h / 2 - 15}
            rx={6} fill="#3b82f615" />
          {/* Waves */}
          <path d={`M ${item.x + 15} ${cy}
            Q ${item.x + item.w * 0.3} ${cy - 12} ${cx} ${cy}
            Q ${item.x + item.w * 0.7} ${cy + 12} ${item.x + item.w - 15} ${cy}`}
            fill="none" stroke="#3b82f630" strokeWidth="3" />
        </g>
      )

    case 'deposito_gris':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={10}
            fill="#f3f4f630" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          <rect x={item.x + 15} y={cy} width={item.w - 30} height={item.h / 2 - 15}
            rx={6} fill="#6b728015" />
          <path d={`M ${item.x + 15} ${cy}
            Q ${item.x + item.w * 0.3} ${cy - 12} ${cx} ${cy}
            Q ${item.x + item.w * 0.7} ${cy + 12} ${item.x + item.w - 15} ${cy}`}
            fill="none" stroke="#6b728030" strokeWidth="3" />
        </g>
      )

    case 'bomba':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#e0f2fe30" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Impeller circle */}
          <circle cx={cx} cy={cy} r={Math.min(item.w, item.h) * 0.25}
            fill="none" stroke="#0ea5e940" strokeWidth="3" />
          {/* Blades */}
          {[0, 120, 240].map(a => {
            const rad = (a * Math.PI) / 180
            const r = Math.min(item.w, item.h) * 0.22
            return <line key={a} x1={cx} y1={cy}
              x2={cx + Math.cos(rad) * r} y2={cy + Math.sin(rad) * r}
              stroke="#0ea5e940" strokeWidth="3" />
          })}
        </g>
      )

    case 'calentador':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={8}
            fill="#fef2f230" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Flame */}
          <path d={`M ${cx} ${cy + 20}
            Q ${cx - 15} ${cy - 5} ${cx} ${cy - 25}
            Q ${cx + 15} ${cy - 5} ${cx} ${cy + 20}`}
            fill="#ef444420" stroke="#ef444440" strokeWidth="3" />
        </g>
      )

    case 'grifo_cocina':
    case 'grifo_ducha':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.w * 0.2}
            fill="#ecfeff30" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Faucet arc */}
          <path d={`M ${cx - 15} ${cy + 10}
            L ${cx - 15} ${cy - 10}
            Q ${cx - 15} ${cy - 20} ${cx} ${cy - 20}
            L ${cx + 10} ${cy - 20}`}
            fill="none" stroke="#06b6d450" strokeWidth="4" strokeLinecap="round" />
          {/* Drop */}
          <circle cx={cx + 10} cy={cy} r={4} fill="#06b6d440" />
        </g>
      )

    case 'filtro':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill="#f0fdfa30" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Filter mesh lines */}
          {[0.3, 0.5, 0.7].map(f => (
            <line key={f} x1={item.x + 8} y1={item.y + item.h * f}
              x2={item.x + item.w - 8} y2={item.y + item.h * f}
              stroke="#14b8a630" strokeWidth="2" strokeDasharray="6,3" />
          ))}
        </g>
      )

    case 'desague':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.w * 0.2}
            fill="#f5f5f430" stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Drain circles */}
          <circle cx={cx} cy={cy} r={Math.min(item.w, item.h) * 0.25}
            fill="none" stroke="#78716c30" strokeWidth="3" />
          <circle cx={cx} cy={cy} r={Math.min(item.w, item.h) * 0.1}
            fill="#78716c25" />
        </g>
      )

    case 'tuberia_fria':
    case 'tuberia_caliente':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={item.h / 2}
            fill={item.color + '20'} stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
          {/* Flow arrows */}
          {Array.from({ length: Math.max(2, Math.floor(item.w / 100)) }, (_, i) => (
            <text key={i}
              x={item.x + 30 + i * ((item.w - 60) / Math.max(1, Math.floor(item.w / 100) - 1))}
              y={cy + 6} textAnchor="middle" fontSize="16"
              fill={item.color + '60'} fontFamily="Arial">▶</text>
          ))}
        </g>
      )

    default:
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} rx={6}
            fill={item.color + '15'} stroke={selStroke} strokeWidth={selWidth} strokeDasharray={dash} />
        </g>
      )
  }
}

// ── Placement cotas (dimension marks) ─────────────────────────────
function InteriorCotas({ item, floor }: { item: InteriorItem; floor: ReturnType<typeof getFloor> }) {
  const { cabinDepth: cd, wallThickness: wt } = floor
  const dFromCabin = item.x - cd  // distance from cabin wall
  const dFromLeftWall = item.y - wt  // distance from left (conductor) wall
  const cotaColor = '#f43f5e'

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Horizontal cota: distance from cabin wall */}
      <line x1={cd} y1={item.y - 25} x2={item.x} y2={item.y - 25}
        stroke={cotaColor} strokeWidth="2" markerStart="url(#arrowL-int)" markerEnd="url(#arrowR-int)" />
      <text x={(cd + item.x) / 2} y={item.y - 35} textAnchor="middle"
        fontSize="36" fill={cotaColor} fontWeight="700" fontFamily="Arial">
        {dFromCabin} mm
      </text>

      {/* Vertical cota: distance from left (conductor) wall */}
      <line x1={item.x + item.w + 20} y1={wt} x2={item.x + item.w + 20} y2={item.y}
        stroke={cotaColor} strokeWidth="2" markerStart="url(#arrowU-int)" markerEnd="url(#arrowD-int)" />
      <text x={item.x + item.w + 30} y={(wt + item.y) / 2 + 10}
        fontSize="32" fill={cotaColor} fontWeight="700" fontFamily="Arial"
        transform={`rotate(-90 ${item.x + item.w + 30} ${(wt + item.y) / 2 + 10})`}
        textAnchor="middle">
        {dFromLeftWall}
      </text>

      {/* Dimensions label */}
      <text x={item.x + item.w / 2} y={item.y + item.h + 35} textAnchor="middle"
        fontSize="30" fill="#64748b" fontWeight="600" fontFamily="Arial">
        {item.w}×{item.h} mm
      </text>
    </g>
  )
}

// ── Arrow markers for cotas ───────────────────────────────────────
function CotaMarkersInt() {
  return (
    <defs>
      <marker id="arrowR-int" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <path d="M 0 0 L 8 3 L 0 6" fill="#f43f5e" />
      </marker>
      <marker id="arrowL-int" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
        <path d="M 8 0 L 0 3 L 8 6" fill="#f43f5e" />
      </marker>
      <marker id="arrowU-int" markerWidth="6" markerHeight="8" refX="3" refY="0" orient="auto">
        <path d="M 0 8 L 3 0 L 6 8" fill="#f43f5e" />
      </marker>
      <marker id="arrowD-int" markerWidth="6" markerHeight="8" refX="3" refY="8" orient="auto">
        <path d="M 0 0 L 3 8 L 6 0" fill="#f43f5e" />
      </marker>
    </defs>
  )
}

// ── Legend mini symbols (36×24 px) ────────────────────────────────
function InteriorLegendMini({ type, color }: { type: string; color: string }) {
  const w = 36, h = 24
  switch (type) {
    case 'cama':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={3} fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.5" />
        <rect x={3} y={3} width={10} height={18} rx={4} fill="#c4b5fd60" stroke="#8b5cf640" strokeWidth="1" />
      </svg>)
    case 'cocina':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={2} fill="#fff7ed" stroke="#f97316" strokeWidth="1.5" />
        <circle cx={12} cy={9} r={3} fill="none" stroke="#f9731660" strokeWidth="1" />
        <circle cx={24} cy={9} r={3} fill="none" stroke="#f9731660" strokeWidth="1" />
        <circle cx={12} cy={17} r={3} fill="none" stroke="#f9731660" strokeWidth="1" />
        <circle cx={24} cy={17} r={3} fill="none" stroke="#f9731660" strokeWidth="1" />
      </svg>)
    case 'nevera':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={2} fill="#ecfeff" stroke="#06b6d4" strokeWidth="1.5" />
        <line x1={18} y1={4} x2={18} y2={20} stroke="#06b6d440" strokeWidth="1.5" />
        <line x1={12} y1={8} x2={24} y2={16} stroke="#06b6d440" strokeWidth="1" />
        <line x1={24} y1={8} x2={12} y2={16} stroke="#06b6d440" strokeWidth="1" />
      </svg>)
    case 'armario':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={2} fill="#f3e8ff" stroke="#a855f7" strokeWidth="1.5" />
        <line x1={18} y1={3} x2={18} y2={21} stroke="#a855f740" strokeWidth="1" />
        <circle cx={15} cy={12} r={2} fill="#a855f750" /><circle cx={21} cy={12} r={2} fill="#a855f750" />
      </svg>)
    case 'bateria':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={2} fill="#fef2f2" stroke="#dc2626" strokeWidth="1.5" />
        <text x={6} y={14} fontSize="10" fill="#dc2626" fontWeight="900">+</text>
        <text x={27} y={14} fontSize="10" fill="#64748b" fontWeight="900">−</text>
      </svg>)
    case 'enchufe':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={6} fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
        <circle cx={14} cy={12} r={3} fill="#3b82f640" /><circle cx={22} cy={12} r={3} fill="#3b82f640" />
      </svg>)
    case 'luz':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <circle cx={18} cy={12} r={10} fill="#fefce880" stroke="#eab308" strokeWidth="1.5" />
        {[0, 60, 120, 180, 240, 300].map(a => {
          const rad = (a * Math.PI) / 180
          return <line key={a} x1={18 + Math.cos(rad) * 5} y1={12 + Math.sin(rad) * 5}
            x2={18 + Math.cos(rad) * 9} y2={12 + Math.sin(rad) * 9}
            stroke="#eab30860" strokeWidth="1" />
        })}
      </svg>)
    case 'deposito':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={4} fill="#dbeafe40" stroke={color} strokeWidth="1.5" />
        <rect x={4} y={12} width={28} height={8} rx={3} fill={color + '20'} />
        <path d="M 4 12 Q 12 9 18 12 Q 24 15 32 12" fill="none" stroke={color + '50'} strokeWidth="1" />
      </svg>)
    case 'bomba':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={2} fill="#e0f2fe40" stroke="#0ea5e9" strokeWidth="1.5" />
        <circle cx={18} cy={12} r={6} fill="none" stroke="#0ea5e940" strokeWidth="1.5" />
        {[0, 120, 240].map(a => {
          const rad = (a * Math.PI) / 180
          return <line key={a} x1={18} y1={12} x2={18 + Math.cos(rad) * 5} y2={12 + Math.sin(rad) * 5}
            stroke="#0ea5e940" strokeWidth="1" />
        })}
      </svg>)
    case 'grifo':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={4} fill="#ecfeff40" stroke="#06b6d4" strokeWidth="1.5" />
        <path d="M 12 16 L 12 8 Q 12 5 15 5 L 22 5" fill="none" stroke="#06b6d460" strokeWidth="2" strokeLinecap="round" />
        <circle cx={22} cy={12} r={2.5} fill="#06b6d440" />
      </svg>)
    case 'tuberia':
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={8} width={34} height={8} rx={4} fill={color + '30'} stroke={color} strokeWidth="1.5" />
        <text x={12} y={15} fontSize="8" fill={color + '80'}>▶</text>
        <text x={22} y={15} fontSize="8" fill={color + '80'}>▶</text>
      </svg>)
    default:
      return (<svg width={w} height={h} viewBox="0 0 36 24">
        <rect x={1} y={1} width={34} height={22} rx={2} fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
        <text x={18} y={16} textAnchor="middle" fontSize="10" fill="#64748b">?</text>
      </svg>)
  }
}

// ── Legend items definition ───────────────────────────────────────
const INTERIOR_LEGEND: { type: string; label: string; desc: string; color: string; layer: DiagramLayer }[] = [
  { type: 'cama', label: 'Cama', desc: 'Almohada + mantas', color: '#8b5cf6', layer: 'furniture' },
  { type: 'cocina', label: 'Cocina', desc: 'Fogones + fregadero', color: '#f97316', layer: 'furniture' },
  { type: 'nevera', label: 'Nevera', desc: 'Copo de nieve', color: '#06b6d4', layer: 'furniture' },
  { type: 'armario', label: 'Armario', desc: 'Puertas con tiradores', color: '#a855f7', layer: 'furniture' },
  { type: 'bateria', label: 'Batería', desc: 'Terminales +/−', color: '#dc2626', layer: 'electrical' },
  { type: 'enchufe', label: 'Enchufe', desc: 'Orificios circulares', color: '#3b82f6', layer: 'electrical' },
  { type: 'luz', label: 'Luz/LED', desc: 'Rayos irradiados', color: '#eab308', layer: 'electrical' },
  { type: 'deposito', label: 'Depósito', desc: 'Olas + nivel', color: '#3b82f6', layer: 'water' },
  { type: 'bomba', label: 'Bomba', desc: 'Aspa giratoria', color: '#0ea5e9', layer: 'water' },
  { type: 'grifo', label: 'Grifo', desc: 'Caño + gota', color: '#06b6d4', layer: 'water' },
  { type: 'tuberia', label: 'Tubería', desc: 'Tramo con flujo', color: '#3b82f6', layer: 'water' },
]

// ── Floor bounds clamp ────────────────────────────────────────────
function clampFloor(x: number, y: number, w: number, h: number, floor: ReturnType<typeof getFloor>) {
  const { cabinDepth: cd, wallThickness: wt, length: fl, width: fw } = floor
  return {
    x: Math.max(cd, Math.min(cd + fl - w, x)),
    y: Math.max(wt, Math.min(wt + fw - h, y)),
  }
}

// ── SVG Floor Plan ────────────────────────────────────────────────
function VanFloorPlanSVG({ floor, van }: { floor: ReturnType<typeof getFloor>; van: VanConfig }) {
  const { length: l, width: w, wallThickness: wt, cabinDepth: cd } = floor
  const totalL = l + cd

  // ── Van body silhouette (top-down exterior profile) ──
  // Show the exterior body section around the cargo area so the user
  // can see van width / shape behind the interior floor plan.
  const vanW   = van.width           // full exterior width
  const floorMidY = wt + w / 2      // vertical centre of the interior
  const extHalfW  = vanW / 2
  const extTop = floorMidY - extHalfW
  const extBot = floorMidY + extHalfW
  // Body section X range (cargo): aligned with cd..cd+bodyLength in floor coords
  const bodyX0 = cd
  const bodyX1 = cd + van.bodyLength

  // Cab hint: small nose to the left of body start
  const cabLen = Math.min(van.bodyStart, cd)   // limited so it stays inside viewBox
  const cabX0  = bodyX0 - cabLen
  const cabNarrow = 100                        // cab tapers ~100mm each side

  return (
    <g className="van-floor" stroke="#94a3b8" strokeWidth="6" fill="none">
      {/* ── Exterior van profile (background) ── */}
      <g className="van-exterior-profile" opacity={0.30}>
        {/* Cargo body section — rounded rect */}
        <path d={`
          M ${bodyX0} ${extTop + 40}
          L ${bodyX1 - 80} ${extTop + 40}
          Q ${bodyX1 + 20} ${extTop + 40} ${bodyX1 + 20} ${extTop + 120}
          L ${bodyX1 + 20} ${extBot - 120}
          Q ${bodyX1 + 20} ${extBot - 40} ${bodyX1 - 80} ${extBot - 40}
          L ${bodyX0} ${extBot - 40}
          Z
        `} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="4" />

        {/* Cab nose — tapered shape */}
        <path d={`
          M ${bodyX0} ${extTop + 40}
          L ${cabX0 + 60} ${extTop + 40 + cabNarrow}
          Q ${cabX0} ${extTop + 40 + cabNarrow} ${cabX0} ${extTop + 40 + cabNarrow + 60}
          L ${cabX0} ${extBot - 40 - cabNarrow - 60}
          Q ${cabX0} ${extBot - 40 - cabNarrow} ${cabX0 + 60} ${extBot - 40 - cabNarrow}
          L ${bodyX0} ${extBot - 40}
          Z
        `} fill="#e8ecf0" stroke="#94a3b8" strokeWidth="3" />

        {/* Wheel arcs (only rear wheels typically visible in body area) */}
        {[van.frontWheelX, van.rearWheelX].map((wx, i) => {
          const wDia = van.wheelDia ?? 680
          // Map wheel position to floor coords: wx=van coord, cd=bodyStart in floor
          const cx = cd + (wx - van.bodyStart)
          // Only render if within visible body section
          if (cx < cabX0 - wDia || cx > bodyX1 + wDia) return null
          return (
            <g key={`wheel-${i}`}>
              <rect x={cx - wDia / 2} y={extTop + 10} width={wDia} height={35} rx={8}
                fill="#cbd5e1" stroke="none" />
              <rect x={cx - wDia / 2} y={extBot - 45} width={wDia} height={35} rx={8}
                fill="#cbd5e1" stroke="none" />
            </g>
          )
        })}

        {/* Exterior width text label */}
        <text x={bodyX0 + van.bodyLength / 2} y={extBot + 30}
          textAnchor="middle" fontSize="50" fill="#94a3b8" fontFamily="Arial" opacity={0.7}>
          ancho ext. {vanW} mm
        </text>
      </g>

      {/* Floor outline with rounded rear */}
      <path d={`
        M ${cd} ${wt}
        L ${totalL - 80} ${wt}
        Q ${totalL} ${wt} ${totalL} ${wt + 80}
        L ${totalL} ${w + wt - 80}
        Q ${totalL} ${w + wt} ${totalL - 80} ${w + wt}
        L ${cd} ${w + wt}
        L ${cd} ${wt}
      `} fill="#f8fafc" stroke="#94a3b8" strokeWidth="8" />

      {/* Walls - double line */}
      <rect x={cd - wt} y={0} width={wt} height={w + wt * 2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" />
      <path d={`
        M ${cd} ${0}
        L ${totalL - 80} ${0}
        Q ${totalL + wt} ${0} ${totalL + wt} ${80}
        L ${totalL + wt} ${w + wt * 2 - 80}
        Q ${totalL + wt} ${w + wt * 2} ${totalL - 80} ${w + wt * 2}
        L ${cd} ${w + wt * 2}
      `} fill="none" stroke="#94a3b8" strokeWidth="3" />

      {/* Cabin reference */}
      <rect x={0} y={wt + 100} width={cd - wt} height={w - 200}
        fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="3" rx={20} />
      <text x={(cd - wt) / 2} y={wt + w / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize="60" fill="#94a3b8" fontFamily="Arial">Cabina</text>

      {/* Cabin separation */}
      <line x1={cd} y1={0} x2={cd} y2={w + wt * 2}
        stroke="#94a3b8" strokeWidth="4" strokeDasharray="20,10" />

      {/* Grid (250mm) */}
      {Array.from({ length: Math.floor(l / 250) }, (_, i) => (i + 1) * 250).map(x => (
        <line key={`gx-${x}`} x1={cd + x} y1={wt} x2={cd + x} y2={w + wt}
          stroke="#f1f5f9" strokeWidth="1" strokeDasharray="10,10" />
      ))}
      {Array.from({ length: Math.floor(w / 250) }, (_, i) => (i + 1) * 250).map(y => (
        <line key={`gy-${y}`} x1={cd} y1={wt + y} x2={totalL} y2={wt + y}
          stroke="#f1f5f9" strokeWidth="1" strokeDasharray="10,10" />
      ))}

      {/* Center line */}
      <line x1={cd} y1={wt + w / 2} x2={totalL} y2={wt + w / 2}
        stroke="#e2e8f0" strokeWidth="2" strokeDasharray="30,15" />

      {/* Side labels */}
      <text x={cd + l / 2} y={-20} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">IZQUIERDO (conductor)</text>
      <text x={cd + l / 2} y={w + wt * 2 + 60} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">DERECHO (pasajero)</text>

      {/* Dimensions */}
      <text x={cd + l / 2} y={w + wt * 2 + 130} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial">{l} mm</text>
      <text x={-60} y={wt + w / 2} textAnchor="middle" fontSize="60"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${wt + w / 2})`}>{w} mm</text>

      {/* Direction arrow */}
      <text x={cd + 80} y={wt + 80} fontSize="60" fill="#cbd5e1" fontFamily="Arial">← Frontal</text>
      <text x={totalL - 500} y={wt + 80} fontSize="60" fill="#cbd5e1" fontFamily="Arial">Trasera →</text>
    </g>
  )
}

// ── Van Config panel ──────────────────────────────────────────────
function VanConfigPanel({ config, preset, onPreset, onChange }: {
  config: VanConfig
  preset: string
  onPreset: (key: string) => void
  onChange: (c: VanConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const floor = getFloor(config)
  const fields: { key: keyof VanConfig; label: string }[] = [
    { key: 'bodyLength', label: 'Largo carga' },
    { key: 'width', label: 'Ancho total' },
    { key: 'bodyHeight', label: 'Alto carga' },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
        <span>🚐 Furgoneta: {VAN_PRESETS[preset]?.label ?? 'Personalizado'}</span>
        <span className="text-xs text-slate-400">{open ? '▲' : '▼'} suelo: {floor.length}×{floor.width} mm</span>
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
          <div className="grid grid-cols-3 gap-2 text-xs">
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-slate-400 block mb-0.5">{f.label} (mm)</label>
                <input type="number" value={config[f.key]} step={50}
                  onChange={e => {
                    onChange({ ...config, [f.key]: +e.target.value })
                    onPreset('custom')
                  }}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">
            Suelo interior derivado: {floor.length}×{floor.width} mm (descontando paredes)
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function VanInteriorDesign() {
  const navigate = useNavigate()
  const { workOrderId, projectId } = useParams<{ workOrderId?: string; projectId?: string }>()
  const isWoMode = !!workOrderId
  const configId = workOrderId ?? projectId ?? 'free'

  // Van config state
  const [van, setVan] = useState<VanConfig>(() => loadVanConfig(configId) ?? DEFAULT_VAN)
  const [preset, setPreset] = useState<string>(() => findPreset(van) ?? DEFAULT_PRESET)
  const floor = useMemo(() => getFloor(van), [van])

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
  const [woPalettes, setWoPalettes] = useState<Record<DiagramLayer, (PaletteItem & { fromQuote?: boolean })[]>>({
    furniture: [], electrical: [], water: []
  })
  const [items, setItems] = useState<InteriorItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [activeLayer, setActiveLayer] = useState<DiagramLayer>('furniture')
  const [visibleLayers, setVisibleLayers] = useState<Set<DiagramLayer>>(new Set(['furniture', 'electrical', 'water']))
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCotas, setShowCotas] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Catalog-based palettes for free mode ───────────────────────
  const [catalogPalettes, setCatalogPalettes] = useState<Record<DiagramLayer, PaletteItem[]>>({
    furniture: [], electrical: [], water: []
  })
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
        const grouped: Record<DiagramLayer, PaletteItem[]> = {
          furniture: [], electrical: [], water: []
        }
        const seen = new Set<string>()
        for (const p of products) {
          const item = catalogToInteriorPalette(p)
          if (item) {
            const key = `${item.type}-${item.label}`
            if (!seen.has(key)) {
              seen.add(key)
              grouped[item.layer].push(item)
            }
          }
        }
        setCatalogPalettes(grouped)
        setCatalogLoaded(true)
      } catch { /* fallback to hardcoded */ }
    })()
  }, [isWoMode])

  // Load available WOs + production projects for linking (free mode only)
  useEffect(() => {
    if (isWoMode) return
    ;(async () => {
      try {
        const wos = await FurnitureWorkOrderService.getAllByType('interior')
        setAvailableWOs(wos)
      } catch { /* ignore */ }
      try {
        const pps = await ProductionService.getProjects()
        setAvailablePPs(pps)
      } catch { /* ignore */ }
    })()
  }, [isWoMode])

  // Load WO data or saved design
  useEffect(() => {
    if (workOrderId) {
      ;(async () => {
        try {
          const wo = await FurnitureWorkOrderService.getById(workOrderId)
          if (wo) {
            setWorkOrder(wo)
            const grouped: Record<DiagramLayer, (PaletteItem & { fromQuote?: boolean })[]> = {
              furniture: [], electrical: [], water: []
            }
            ;(wo.items ?? []).forEach((item, idx) => {
              const mapped = quoteItemToInteriorPalette(item as FurnitureWorkOrderItem, idx)
              grouped[mapped.layer].push(mapped)
            })
            setWoPalettes(grouped)
          }
          const { data } = await supabase
            .from('interior_designs')
            .select('items')
            .eq('work_order_id', workOrderId)
            .maybeSingle()
          if (data?.items) setItems(data.items)
        } catch { /* empty */ }
      })()
    } else if (projectId) {
      ;(async () => {
        try {
          const { data } = await supabase
            .from('interior_designs')
            .select('items')
            .eq('project_id', projectId)
            .maybeSingle()
          if (data?.items) setItems(data.items)
        } catch { /* empty */ }
      })()
    }
  }, [workOrderId, projectId])

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
    (e: React.MouseEvent, id: string) => {
      e.preventDefault()
      e.stopPropagation()
      const item = items.find(i => i.id === id)
      if (!item) return
      const pt = svgPoint(e.clientX, e.clientY)
      setDragging({ id, offsetX: pt.x - item.x, offsetY: pt.y - item.y })
      setSelected(id)
    }, [items, svgPoint],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      const pt = svgPoint(e.clientX, e.clientY)
      setItems(prev =>
        prev.map(it => {
          if (it.id !== dragging.id) return it
          const raw = { x: snap(pt.x - dragging.offsetX), y: snap(pt.y - dragging.offsetY) }
          const clamped = clampFloor(raw.x, raw.y, it.w, it.h, floor)
          return { ...it, ...clamped }
        }),
      )
    }, [dragging, svgPoint, floor],
  )

  const handleMouseUp = useCallback(() => setDragging(null), [])

  const addItem = (tpl: PaletteItem) => {
    const { length: l, width: w, wallThickness: wt, cabinDepth: cd } = floor
    const rawX = snap(cd + l / 2 - tpl.w / 2)
    const rawY = snap(wt + w / 2 - tpl.h / 2)
    const clamped = clampFloor(rawX, rawY, tpl.w, tpl.h, floor)
    const item: InteriorItem = {
      id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      layer: tpl.layer,
      type: tpl.type,
      label: tpl.label,
      w: tpl.w,
      h: tpl.h,
      ...clamped,
      rotation: 0,
      color: tpl.color,
      icon: tpl.icon,
    }
    setItems(prev => [...prev, item])
    setSelected(item.id)
    toast.success(`${tpl.label} añadido`)
  }

  const deleteSelected = () => {
    if (!selected) return
    setItems(prev => prev.filter(i => i.id !== selected))
    setSelected(null)
  }

  const rotateSelected = () => {
    if (!selected) return
    setItems(prev =>
      prev.map(it => {
        if (it.id !== selected) return it
        const rotated = { ...it, rotation: (it.rotation + 90) % 360, w: it.h, h: it.w }
        const clamped = clampFloor(rotated.x, rotated.y, rotated.w, rotated.h, floor)
        return { ...rotated, ...clamped }
      }),
    )
  }

  const duplicateSelected = () => {
    const src = items.find(i => i.id === selected)
    if (!src) return
    const dup: InteriorItem = {
      ...src,
      id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: src.x + 100,
      y: src.y + 100,
    }
    const clamped = clampFloor(dup.x, dup.y, dup.w, dup.h, floor)
    setItems(prev => [...prev, { ...dup, ...clamped }])
    setSelected(dup.id)
  }

  const toggleLayerVisibility = (layer: DiagramLayer) => {
    setVisibleLayers(prev => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
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
          .from('interior_designs')
          .select('id')
          .eq('work_order_id', effectiveWoId)
          .maybeSingle()
        if (existing) {
          await supabase
            .from('interior_designs')
            .update({ items, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          const wo = workOrder || linkedWO
          await supabase
            .from('interior_designs')
            .insert({ work_order_id: effectiveWoId, project_id: wo?.project_id, items })
        }
        const wo = workOrder || linkedWO
        if (wo) {
          const updatedItems = (wo.items as FurnitureWorkOrderItem[]).map(item => ({
            ...item,
            designStatus: items.length > 0 ? 'designed' as const : item.designStatus,
          }))
          await FurnitureWorkOrderService.updateItems(wo.id, updatedItems)
        }
      } else if (linkedPP) {
        const { data: existing } = await supabase
          .from('interior_designs')
          .select('id')
          .eq('production_project_id', linkedPP.id)
          .maybeSingle()
        if (existing) {
          await supabase
            .from('interior_designs')
            .update({ items, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('interior_designs')
            .insert({ production_project_id: linkedPP.id, items })
        }
      } else {
        await supabase
          .from('interior_designs')
          .upsert({ project_id: projectId, items, updated_at: new Date().toISOString() })
      }
      // ── Marcar design_ready en el proyecto de producción ──────────
      const ppId = linkedPP?.id || workOrder?.project_id || linkedWO?.project_id || projectId
      if (ppId) {
        try {
          await ProductionService.updateProject(ppId, { design_ready: true })
        } catch { /* non-critical */ }
      }
      toast.success('Diseño interior guardado')
    } catch (err: any) {
      toast.error('Error guardando: ' + (err.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  const visibleItems = useMemo(
    () => items.filter(i => visibleLayers.has(i.layer)),
    [items, visibleLayers],
  )

  const selectedItem = items.find(i => i.id === selected)
  const layerCfg = LAYER_CONFIG[activeLayer]

  // SVG viewBox
  const totalL = floor.length + floor.cabinDepth
  const totalW = floor.width + floor.wallThickness * 2
  const pad = 220

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(isWoMode ? '/design/interior' : '/design')}
            className="text-sm text-blue-600 hover:underline">← {isWoMode ? 'Órdenes' : 'Diseño'}</button>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              🏠 Diseño Interior
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
                Distribución de muebles, diagrama eléctrico y diagrama de agua
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
                        <p className="text-xs text-slate-400 text-center py-4">No hay órdenes de diseño interior</p>
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

      {/* Van config panel */}
      <VanConfigPanel config={van} preset={preset}
        onPreset={handlePreset} onChange={handleVanChange} />

      {/* Layer tabs + visibility toggles */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(Object.entries(LAYER_CONFIG) as [DiagramLayer, typeof LAYER_CONFIG['furniture']][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setActiveLayer(key)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                activeLayer === key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowCotas(!showCotas)}
          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
            showCotas ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}>
          📏 Cotas {showCotas ? 'ON' : 'OFF'}
        </button>

        <div className="flex gap-2 text-xs">
          <span className="text-slate-400 self-center">Capas visibles:</span>
          {(Object.entries(LAYER_CONFIG) as [DiagramLayer, typeof LAYER_CONFIG['furniture']][]).map(([key, cfg]) => (
            <button key={key} onClick={() => toggleLayerVisibility(key)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-all ${
                visibleLayers.has(key)
                  ? 'bg-white border-slate-300 text-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-300 line-through'
              }`}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        {/* ── Canvas ────────────────────────────────────────────── */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 overflow-auto shadow-sm">
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`${-pad} ${-pad} ${totalL + pad * 2 + floor.wallThickness} ${totalW + pad * 2}`}
            className="bg-white rounded-xl cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelected(null)}
          >
            <CotaMarkersInt />
            <VanFloorPlanSVG floor={floor} van={van} />

            {/* Placed items with SVG symbols */}
            {visibleItems.map(item => {
              const isSelected = item.id === selected
              const opacity = item.layer === activeLayer ? 1 : 0.4
              const vis = INTERIOR_VISUALS[item.type] ?? INTERIOR_VISUALS.custom
              return (
                <g key={item.id}
                  onMouseDown={e => handleMouseDown(e, item.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: 'grab', opacity }}
                >
                  {/* Type-specific SVG symbol */}
                  <InteriorItemSymbol item={item} isSelected={isSelected} />

                  {/* Short type badge at top-left */}
                  <rect x={item.x + 4} y={item.y + 4}
                    width={Math.max(32, vis.shortLabel.length * 18 + 10)} height={26}
                    rx={4} fill={vis.strokeStyle} fillOpacity={0.85} />
                  <text x={item.x + 4 + Math.max(32, vis.shortLabel.length * 18 + 10) / 2}
                    y={item.y + 22}
                    textAnchor="middle" fontSize="18" fill="white" fontWeight="800" fontFamily="Arial"
                    style={{ pointerEvents: 'none' }}>
                    {vis.shortLabel}
                  </text>

                  {/* Label in center */}
                  <text
                    x={item.x + item.w / 2}
                    y={item.y + item.h / 2 + 6}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(38, Math.max(14, item.w / 8))}
                    fill={vis.strokeStyle}
                    fontWeight="600"
                    fontFamily="Arial"
                    style={{ pointerEvents: 'none', opacity: 0.9 }}
                  >
                    {item.label}
                  </text>

                  {/* Dimensions */}
                  {item.w > 120 && (
                    <text
                      x={item.x + item.w / 2}
                      y={item.y + item.h - 8}
                      textAnchor="middle"
                      fontSize={Math.min(26, item.w / 10)}
                      fill={vis.strokeStyle}
                      fontFamily="Arial"
                      style={{ pointerEvents: 'none', opacity: 0.5 }}
                    >
                      {item.w}×{item.h}
                    </text>
                  )}

                  {/* Placement cotas */}
                  {showCotas && isSelected && <InteriorCotas item={item} floor={floor} />}
                </g>
              )
            })}
          </svg>

          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>
              {items.filter(i => i.layer === 'furniture').length} muebles ·{' '}
              {items.filter(i => i.layer === 'electrical').length} eléctricos ·{' '}
              {items.filter(i => i.layer === 'water').length} agua
            </span>
            <span>Cuadrícula: 50 mm · Acotados al suelo</span>
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className="space-y-4">
          {selectedItem && (() => {
            const vis = INTERIOR_VISUALS[selectedItem.type] ?? INTERIOR_VISUALS.custom
            const { cabinDepth: cd, wallThickness: wt } = floor
            return (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-4 rounded text-[10px] text-white font-black"
                  style={{ backgroundColor: vis.strokeStyle }}>{vis.shortLabel}</span>
                <span className="truncate">{selectedItem.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
                  style={{ backgroundColor: selectedItem.color + '20', color: selectedItem.color }}>
                  {LAYER_CONFIG[selectedItem.layer].label}
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-0.5">X (mm)</label>
                  <input type="number" value={selectedItem.x} step={50}
                    onChange={e => {
                      const c = clampFloor(+e.target.value, selectedItem.y, selectedItem.w, selectedItem.h, floor)
                      setItems(prev => prev.map(it => it.id === selected ? { ...it, x: c.x } : it))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Y (mm)</label>
                  <input type="number" value={selectedItem.y} step={50}
                    onChange={e => {
                      const c = clampFloor(selectedItem.x, +e.target.value, selectedItem.w, selectedItem.h, floor)
                      setItems(prev => prev.map(it => it.id === selected ? { ...it, y: c.y } : it))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Ancho (mm)</label>
                  <input type="number" value={selectedItem.w} step={10}
                    onChange={e => {
                      const nw = +e.target.value
                      const c = clampFloor(selectedItem.x, selectedItem.y, nw, selectedItem.h, floor)
                      setItems(prev => prev.map(it => it.id === selected ? { ...it, w: nw, ...c } : it))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Alto (mm)</label>
                  <input type="number" value={selectedItem.h} step={10}
                    onChange={e => {
                      const nh = +e.target.value
                      const c = clampFloor(selectedItem.x, selectedItem.y, selectedItem.w, nh, floor)
                      setItems(prev => prev.map(it => it.id === selected ? { ...it, h: nh, ...c } : it))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
              </div>
              {/* Distance readout */}
              <div className="bg-rose-50 rounded-lg px-3 py-2 text-[10px] text-rose-600 font-mono">
                <p>↔ Desde cabina: <b>{selectedItem.x - cd} mm</b></p>
                <p>↕ Desde pared izq: <b>{selectedItem.y - wt} mm</b></p>
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
            )
          })()}

          {/* Palette for active layer */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            {(() => {
              const freePalette = catalogLoaded && catalogPalettes[activeLayer].length > 0
                ? catalogPalettes[activeLayer]
                : layerCfg.palette
              const paletteItems = isWoMode ? (woPalettes[activeLayer] ?? []) : freePalette
              return (
                <>
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    {layerCfg.icon} {isWoMode ? `${layerCfg.label} (presupuesto)` : `${layerCfg.label} (catálogo)`}
                    <span className="text-[10px] text-slate-400 ml-auto font-normal">
                      {paletteItems.length} elementos
                    </span>
                  </h3>
                  {paletteItems.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No hay elementos de {layerCfg.label.toLowerCase()} en {isWoMode ? 'esta orden' : 'el catálogo'}
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                      {paletteItems.map((tpl, idx) => (
                        <button key={`${tpl.type}-${idx}`} onClick={() => addItem(tpl)}
                          className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-xs">
                          <InteriorLegendMini type={
                            tpl.type.startsWith('cama') ? 'cama' :
                            tpl.type.startsWith('cocina') ? 'cocina' :
                            tpl.type.startsWith('nevera') ? 'nevera' :
                            tpl.type.startsWith('enchufe') ? 'enchufe' :
                            tpl.type.startsWith('luz') ? 'luz' :
                            tpl.type.startsWith('deposito') ? 'deposito' :
                            tpl.type.startsWith('grifo') ? 'grifo' :
                            tpl.type.startsWith('tuberia') ? 'tuberia' :
                            tpl.type
                          } color={tpl.color} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 truncate">{tpl.label}</p>
                            <p className="text-[10px] text-slate-400">{tpl.w}×{tpl.h} mm</p>
                          </div>
                          {(tpl as any).fromQuote && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded-full font-bold flex-shrink-0">
                              PRESU
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Symbol legend */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 mb-2">📖 Leyenda de símbolos</h3>
            {(['furniture', 'electrical', 'water'] as DiagramLayer[]).map(layer => {
              const cfg = LAYER_CONFIG[layer]
              const legendItems = INTERIOR_LEGEND.filter(i => i.layer === layer)
              if (!legendItems.length) return null
              return (
                <div key={layer} className="mb-2">
                  <p className="text-[10px] font-bold text-slate-500 mb-1">{cfg.icon} {cfg.label}</p>
                  <div className="space-y-1">
                    {legendItems.map(item => (
                      <div key={item.type} className="flex items-center gap-2 text-[10px]">
                        <InteriorLegendMini type={item.type} color={item.color} />
                        <div>
                          <span className="font-bold text-slate-700">{item.label}</span>
                          <span className="text-slate-400 ml-1">— {item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-600 text-xs">💡 Instrucciones</p>
            <p>• Selecciona la capa (Muebles / Eléctrico / Agua)</p>
            <p>• Cada tipo tiene un <b>símbolo único</b> para identificarlo</p>
            <p>• <span className="text-rose-500 font-bold">Cotas rojas</span> al seleccionar: distancia desde cabina y pared</p>
            <p>• Arrastra para posicionar (acotado al suelo)</p>
            <p>• Activa/desactiva capas para ver cada diagrama</p>
          </div>
        </div>
      </div>
    </div>
  )
}
