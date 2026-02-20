// ─── Technical Blueprint SVG Generator ────────────────────────────────────────
// Generates a clean, printable technical drawing (plano técnico) from furniture
// pieces. This is stored when a design is approved and shown to operators.

import { InteractivePiece, ModuleDimensions, CatalogMaterial } from '../types/furniture.types'
import { PIECE_COLORS } from '../constants/furniture.constants'

interface BlueprintOptions {
  pieces: InteractivePiece[]
  module: ModuleDimensions
  itemName: string
  projectInfo?: string
  catalogMaterials?: CatalogMaterial[]
}

// ─── Dimension line helpers ───────────────────────────────────────────────────

const FONT = 'Arial, Helvetica, sans-serif'
const DIM_COLOR = '#1e40af'
const DIM_FONT_SIZE = 11
const ARROW_SIZE = 4
const DIM_OFFSET = 22    // distance from edge for exterior dimension lines
const PIECE_LABEL_SIZE = 9

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

  // Extension lines (from piece edge to dimension line)
  const ext1 = isHoriz
    ? `<line x1="${x1}" y1="${y1}" x2="${lx1}" y2="${ly1 + (ext > 0 ? 3 : -3)}" stroke="${DIM_COLOR}" stroke-width="0.4" stroke-dasharray="2 1"/>`
    : `<line x1="${x1}" y1="${y1}" x2="${lx1 + (ext > 0 ? 3 : -3)}" y2="${ly1}" stroke="${DIM_COLOR}" stroke-width="0.4" stroke-dasharray="2 1"/>`
  const ext2 = isHoriz
    ? `<line x1="${x2}" y1="${y2}" x2="${lx2}" y2="${ly2 + (ext > 0 ? 3 : -3)}" stroke="${DIM_COLOR}" stroke-width="0.4" stroke-dasharray="2 1"/>`
    : `<line x1="${x2}" y1="${y2}" x2="${lx2 + (ext > 0 ? 3 : -3)}" y2="${ly2}" stroke="${DIM_COLOR}" stroke-width="0.4" stroke-dasharray="2 1"/>`

  // Dimension line with arrows
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

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateBlueprintSVG(opts: BlueprintOptions): string {
  const { pieces, module: mod, itemName, projectInfo, catalogMaterials = [] } = opts
  const visiblePieces = pieces.filter(p => !p.hidden)

  const MARGIN = 60
  const TITLE_HEIGHT = 50
  const INFO_HEIGHT = 80
  const svgW = mod.width + MARGIN * 2
  const svgH = mod.height + MARGIN * 2 + TITLE_HEIGHT + INFO_HEIGHT

  // Material name resolution
  const matMap = new Map(catalogMaterials.map(m => [m.id, m]))
  const defaultMat = mod.catalogMaterialId ? matMap.get(mod.catalogMaterialId) : undefined

  // ─── Build SVG content ──────────────────────────────────────────────────

  const parts: string[] = []

  // Background
  parts.push(`<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="white"/>`)

  // Title block
  parts.push(`<text x="${svgW / 2}" y="28" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="#0f172a">${itemName}</text>`)
  if (projectInfo) {
    parts.push(`<text x="${svgW / 2}" y="44" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#64748b">${projectInfo}</text>`)
  }

  // Drawing area origin
  const ox = MARGIN
  const oy = TITLE_HEIGHT + MARGIN + mod.height  // SVG Y is top-down, pieces Y is bottom-up

  // ─── Draw pieces (frontal view: X horizontal, Y vertical upward) ─────

  for (const p of visiblePieces) {
    const colors = PIECE_COLORS[p.type]
    const px = ox + p.x
    const py = oy - p.y - p.h  // flip Y
    const pw = p.w
    const ph = p.h

    // Piece rect
    const fillColor = p.type === 'frontal' ? 'rgba(59,130,246,0.06)' : 'rgba(148,163,184,0.06)'
    const dashed = p.type === 'trasera' ? ' stroke-dasharray="4 2"' : ''
    parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="1" fill="${fillColor}" stroke="${colors.stroke}" stroke-width="0.8"${dashed}/>`)

    // Piece name
    if (pw > 30 && ph > 20) {
      parts.push(`<text x="${px + pw / 2}" y="${py + ph / 2 - 6}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${PIECE_LABEL_SIZE}" font-weight="600" fill="#334155">${p.name}</text>`)
    }

    // Internal dimensions
    if (pw > 40 && ph > 20) {
      parts.push(`<text x="${px + pw / 2}" y="${py + ph / 2 + 7}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="8" fill="#94a3b8">${Math.round(p.w)}×${Math.round(p.h)}×${Math.round(p.d)}</text>`)
    }

    // Material indicator (small text)
    const pMat = p.materialId ? matMap.get(p.materialId) : defaultMat
    if (pMat && pw > 60 && ph > 40) {
      parts.push(`<text x="${px + pw / 2}" y="${py + ph / 2 + 18}" text-anchor="middle" font-family="${FONT}" font-size="7" fill="#6b7280">${pMat.name}</text>`)
    }
  }

  // ─── Overall dimension lines ────────────────────────────────────────────

  // Width (top)
  parts.push(dimLine(
    ox, oy - mod.height,
    ox + mod.width, oy - mod.height,
    `${mod.width} mm`, 'top'
  ))

  // Height (right)
  parts.push(dimLine(
    ox + mod.width, oy,
    ox + mod.width, oy - mod.height,
    `${mod.height} mm`, 'right'
  ))

  // Depth annotation (bottom-left note)
  parts.push(`<text x="${ox}" y="${oy + 18}" font-family="${FONT}" font-size="9" fill="#64748b">Fondo: ${mod.depth} mm</text>`)

  // ─── Info block (bottom) ────────────────────────────────────────────────

  const infoY = svgH - INFO_HEIGHT + 10
  parts.push(`<line x1="10" y1="${infoY - 5}" x2="${svgW - 10}" y2="${infoY - 5}" stroke="#e2e8f0" stroke-width="0.5"/>`)

  // Module info
  const matName = defaultMat?.name || 'Sin material'
  const thickness = mod.thickness || 16
  parts.push(`<text x="15" y="${infoY + 12}" font-family="${FONT}" font-size="9" font-weight="600" fill="#334155">Material: ${matName} (${thickness}mm)</text>`)
  parts.push(`<text x="15" y="${infoY + 26}" font-family="${FONT}" font-size="9" fill="#64748b">Tipo: ${mod.type} · ${visiblePieces.length} piezas · ${mod.width}×${mod.height}×${mod.depth} mm</text>`)

  // Piece legend
  const estructura = visiblePieces.filter(p => p.type === 'estructura').length
  const frontal = visiblePieces.filter(p => p.type === 'frontal').length
  const trasera = visiblePieces.filter(p => p.type === 'trasera').length
  parts.push(`<text x="15" y="${infoY + 40}" font-family="${FONT}" font-size="8" fill="#94a3b8">Estructura: ${estructura} · Frontal: ${frontal} · Trasera: ${trasera}</text>`)

  // Timestamp
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
