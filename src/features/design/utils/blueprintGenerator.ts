// ─── Technical Blueprint SVG Generator ────────────────────────────────────────
// Generates a clean, printable technical drawing with three orthographic views:
//   ALZADO (frontal / elevation) — X horizontal, Y vertical
//   PLANTA (top / plan)          — X horizontal, Z vertical (depth axis)
//   PERFIL (side / profile)      — Z horizontal, Y vertical
// This is stored when a design is approved and shown to operators.

import { InteractivePiece, ModuleDimensions, CatalogMaterial } from '../types/furniture.types'
import { PIECE_COLORS } from '../constants/furniture.constants'

interface BlueprintOptions {
  pieces: InteractivePiece[]
  module: ModuleDimensions
  itemName: string
  projectInfo?: string
  catalogMaterials?: CatalogMaterial[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = 'Arial, Helvetica, sans-serif'
const DIM_COLOR = '#1e40af'
const DIM_FONT_SIZE = 10
const ARROW_SIZE = 4
const DIM_OFFSET = 20
const PIECE_LABEL_SIZE = 8
const VIEW_GAP = 40       // gap between views
const MARGIN = 50
const TITLE_HEIGHT = 50
const INFO_HEIGHT = 70

// ─── Dimension line helper ────────────────────────────────────────────────────

function dimLine(
  x1: number, y1: number, x2: number, y2: number,
  label: string, side: 'top' | 'bottom' | 'left' | 'right',
): string {
  const isHoriz = side === 'top' || side === 'bottom'
  const ext = side === 'top' || side === 'left' ? -DIM_OFFSET : DIM_OFFSET

  let lx1: number, ly1: number, lx2: number, ly2: number
  let tx: number, ty: number, anchor: string, rotate = ''

  if (isHoriz) {
    lx1 = x1; ly1 = y1 + ext; lx2 = x2; ly2 = y2 + ext
    tx = (lx1 + lx2) / 2; ty = ly1 - 4
    anchor = 'middle'
  } else {
    lx1 = x1 + ext; ly1 = y1; lx2 = x2 + ext; ly2 = y2
    tx = lx1 - 4; ty = (ly1 + ly2) / 2
    anchor = 'middle'
    rotate = ` transform="rotate(-90 ${tx} ${ty})"`
  }

  const ext1 = isHoriz
    ? `<line x1="${x1}" y1="${y1}" x2="${lx1}" y2="${ly1 + (ext > 0 ? 3 : -3)}" stroke="${DIM_COLOR}" stroke-width="0.4" stroke-dasharray="2 1"/>`
    : `<line x1="${x1}" y1="${y1}" x2="${lx1 + (ext > 0 ? 3 : -3)}" y2="${ly1}" stroke="${DIM_COLOR}" stroke-width="0.4" stroke-dasharray="2 1"/>`
  const ext2 = isHoriz
    ? `<line x1="${x2}" y1="${y2}" x2="${lx2}" y2="${ly2 + (ext > 0 ? 3 : -3)}" stroke="${DIM_COLOR}" stroke-width="0.4" stroke-dasharray="2 1"/>`
    : `<line x1="${x2}" y1="${y2}" x2="${lx2 + (ext > 0 ? 3 : -3)}" y2="${ly2}" stroke="${DIM_COLOR}" stroke-width="0.4" stroke-dasharray="2 1"/>`

  const arrowStart = isHoriz
    ? `M${lx1},${ly1} l${ARROW_SIZE},${-ARROW_SIZE / 2} l0,${ARROW_SIZE} z`
    : `M${lx1},${ly1} l${-ARROW_SIZE / 2},${ARROW_SIZE} l${ARROW_SIZE},0 z`
  const arrowEnd = isHoriz
    ? `M${lx2},${ly2} l${-ARROW_SIZE},${-ARROW_SIZE / 2} l0,${ARROW_SIZE} z`
    : `M${lx2},${ly2} l${-ARROW_SIZE / 2},${-ARROW_SIZE} l${ARROW_SIZE},0 z`

  return [
    ext1, ext2,
    `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="${DIM_COLOR}" stroke-width="0.6"/>`,
    `<path d="${arrowStart}" fill="${DIM_COLOR}"/>`,
    `<path d="${arrowEnd}" fill="${DIM_COLOR}"/>`,
    `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-family="${FONT}" font-size="${DIM_FONT_SIZE}" font-weight="600" fill="${DIM_COLOR}"${rotate}>${label}</text>`,
  ].join('\n')
}

// ─── View title ───────────────────────────────────────────────────────────────

function viewTitle(cx: number, y: number, label: string): string {
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="#475569">${label}</text>`
}

// ─── Draw one orthographic view ───────────────────────────────────────────────

function drawView(
  parts: string[],
  visiblePieces: InteractivePiece[],
  matMap: Map<string, CatalogMaterial>,
  defaultMat: CatalogMaterial | undefined,
  ox: number, oy: number,
  viewW: number, viewH: number,
  /**
   * mapper(piece) → { x, y, w, h } in view coordinates (origin top-left)
   * where y grows downward (SVG convention)
   */
  mapper: (p: InteractivePiece) => { x: number; y: number; w: number; h: number },
  dimLabel?: { wLabel: string; hLabel: string },
) {
  // View frame
  parts.push(`<rect x="${ox}" y="${oy}" width="${viewW}" height="${viewH}" fill="none" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="4 2"/>`)

  for (const p of visiblePieces) {
    const colors = PIECE_COLORS[p.type]
    const { x: rx, y: ry, w: rw, h: rh } = mapper(p)
    const px = ox + rx
    const py = oy + ry

    const fillColor = p.type === 'frontal' ? 'rgba(59,130,246,0.06)' : 'rgba(148,163,184,0.06)'
    const dashed = p.type === 'trasera' ? ' stroke-dasharray="4 2"' : ''
    parts.push(`<rect x="${px}" y="${py}" width="${rw}" height="${rh}" rx="1" fill="${fillColor}" stroke="${colors.stroke}" stroke-width="0.8"${dashed}/>`)

    // Piece name (if big enough)
    if (rw > 25 && rh > 14) {
      parts.push(`<text x="${px + rw / 2}" y="${py + rh / 2}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${PIECE_LABEL_SIZE}" font-weight="600" fill="#334155">${p.name}</text>`)
    }
  }

  // Dimension lines
  if (dimLabel) {
    parts.push(dimLine(ox, oy, ox + viewW, oy, dimLabel.wLabel, 'top'))
    parts.push(dimLine(ox + viewW, oy, ox + viewW, oy + viewH, dimLabel.hLabel, 'right'))
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateBlueprintSVG(opts: BlueprintOptions): string {
  const { pieces, module: mod, itemName, projectInfo, catalogMaterials = [] } = opts
  const visiblePieces = pieces.filter(p => !p.hidden)

  const matMap = new Map(catalogMaterials.map(m => [m.id, m]))
  const defaultMat = mod.catalogMaterialId ? matMap.get(mod.catalogMaterialId) : undefined

  // ─── Layout: Alzado + Perfil side by side, Planta below Alzado ─────────
  //
  //  ┌─────────────────────┐   ┌───────────┐
  //  │      ALZADO          │   │  PERFIL   │
  //  │  (ancho × alto)      │   │(fondo×alto)│
  //  └─────────────────────┘   └───────────┘
  //  ┌─────────────────────┐
  //  │      PLANTA          │
  //  │  (ancho × fondo)     │
  //  └─────────────────────┘

  const alzadoW = mod.width
  const alzadoH = mod.height
  const perfilW = mod.depth
  const perfilH = mod.height
  const plantaW = mod.width
  const plantaH = mod.depth

  // Row 1: alzado + gap + perfil
  const row1W = alzadoW + VIEW_GAP + perfilW
  const row1H = Math.max(alzadoH, perfilH)
  // Row 2: planta
  const row2W = plantaW
  const row2H = plantaH

  const contentW = Math.max(row1W, row2W)
  const contentH = row1H + VIEW_GAP + row2H

  const svgW = contentW + MARGIN * 2
  const svgH = TITLE_HEIGHT + contentH + MARGIN * 2 + INFO_HEIGHT

  const parts: string[] = []

  // Background
  parts.push(`<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="white"/>`)

  // Title
  parts.push(`<text x="${svgW / 2}" y="28" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="#0f172a">${itemName}</text>`)
  if (projectInfo) {
    parts.push(`<text x="${svgW / 2}" y="44" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#64748b">${projectInfo}</text>`)
  }

  // ─── Alzado (frontal): X = width, Y = height ──────────────────────────

  const alzOx = MARGIN
  const alzOy = TITLE_HEIGHT + MARGIN
  parts.push(viewTitle(alzOx + alzadoW / 2, alzOy - 8, 'ALZADO (frontal)'))

  drawView(parts, visiblePieces, matMap, defaultMat, alzOx, alzOy, alzadoW, alzadoH,
    (p) => ({
      x: p.x,
      y: alzadoH - p.y - p.h,  // flip Y (pieces Y is bottom-up)
      w: p.w,
      h: p.h,
    }),
    { wLabel: `${mod.width} mm`, hLabel: `${mod.height} mm` },
  )

  // ─── Perfil (side): X = depth, Y = height ─────────────────────────────

  const perOx = MARGIN + alzadoW + VIEW_GAP
  const perOy = TITLE_HEIGHT + MARGIN
  parts.push(viewTitle(perOx + perfilW / 2, perOy - 8, 'PERFIL (lateral)'))

  drawView(parts, visiblePieces, matMap, defaultMat, perOx, perOy, perfilW, perfilH,
    (p) => ({
      x: p.z,
      y: perfilH - p.y - p.h,  // flip Y
      w: p.d,
      h: p.h,
    }),
    { wLabel: `${mod.depth} mm`, hLabel: `${mod.height} mm` },
  )

  // ─── Planta (top/plan): X = width, Y = depth ──────────────────────────

  const pltOx = MARGIN
  const pltOy = TITLE_HEIGHT + MARGIN + row1H + VIEW_GAP
  parts.push(viewTitle(pltOx + plantaW / 2, pltOy - 8, 'PLANTA (superior)'))

  drawView(parts, visiblePieces, matMap, defaultMat, pltOx, pltOy, plantaW, plantaH,
    (p) => ({
      x: p.x,
      y: p.z,              // Z grows into the page → Y in plan view
      w: p.w,
      h: p.d,
    }),
    { wLabel: `${mod.width} mm`, hLabel: `${mod.depth} mm` },
  )

  // ─── Piece legend (right of planta) ─────────────────────────────────────

  const legOx = MARGIN + plantaW + 30
  const legOy = pltOy + 5
  if (legOx + 120 < svgW) {
    parts.push(`<text x="${legOx}" y="${legOy}" font-family="${FONT}" font-size="9" font-weight="700" fill="#334155">Piezas</text>`)
    let ly = legOy + 14
    for (const p of visiblePieces) {
      const colors = PIECE_COLORS[p.type]
      const pMat = p.materialId ? matMap.get(p.materialId) : defaultMat
      parts.push(`<rect x="${legOx}" y="${ly - 7}" width="8" height="8" rx="1" fill="${colors.stroke}" opacity="0.3" stroke="${colors.stroke}" stroke-width="0.5"/>`)
      const dimText = `${Math.round(p.w)}×${Math.round(p.h)}×${Math.round(p.d)}`
      const matText = pMat ? ` — ${pMat.name}` : ''
      parts.push(`<text x="${legOx + 12}" y="${ly}" font-family="${FONT}" font-size="7" fill="#475569">${p.name}: ${dimText}${matText}</text>`)
      ly += 12
      if (ly > pltOy + plantaH) break // avoid overflow
    }
  }

  // ─── Info block (bottom) ────────────────────────────────────────────────

  const infoY = svgH - INFO_HEIGHT + 10
  parts.push(`<line x1="10" y1="${infoY - 5}" x2="${svgW - 10}" y2="${infoY - 5}" stroke="#e2e8f0" stroke-width="0.5"/>`)

  const matName = defaultMat?.name || 'Sin material'
  const thickness = mod.thickness || 16
  parts.push(`<text x="15" y="${infoY + 12}" font-family="${FONT}" font-size="9" font-weight="600" fill="#334155">Material: ${matName} (${thickness}mm)</text>`)
  parts.push(`<text x="15" y="${infoY + 26}" font-family="${FONT}" font-size="9" fill="#64748b">Tipo: ${mod.type} · ${visiblePieces.length} piezas · ${mod.width}×${mod.height}×${mod.depth} mm</text>`)

  const estructura = visiblePieces.filter(p => p.type === 'estructura').length
  const frontal = visiblePieces.filter(p => p.type === 'frontal').length
  const trasera = visiblePieces.filter(p => p.type === 'trasera').length
  parts.push(`<text x="15" y="${infoY + 40}" font-family="${FONT}" font-size="8" fill="#94a3b8">Estructura: ${estructura} · Frontal: ${frontal} · Trasera: ${trasera}</text>`)

  const now = new Date()
  const ts = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
  parts.push(`<text x="${svgW - 15}" y="${infoY + 12}" text-anchor="end" font-family="${FONT}" font-size="8" fill="#94a3b8">${ts}</text>`)
  parts.push(`<text x="${svgW - 15}" y="${infoY + 26}" text-anchor="end" font-family="${FONT}" font-size="8" fill="#94a3b8">VanSpace Workshop</text>`)

  // ─── Assemble full SVG ──────────────────────────────────────────────────

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`,
    ...parts,
    '</svg>',
  ].join('\n')
}
