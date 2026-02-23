// ─── Technical Blueprint SVG Generator ────────────────────────────────────────
// Generates a professional technical drawing with four views:
//   ALZADO  (frontal / elevation) — X horizontal, Y vertical
//   PERFIL  (side / profile)      — Z horizontal, Y vertical
//   PLANTA  (top / plan)          — X horizontal, Z vertical
//   ISOMÉTRICA (3D isometric)     — axonometric 30° projection
// Labels and dimensions are spaced to never overlap.

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
const DIM_FONT = 10
const ARROW = 4
const DIM_SPACE = 32        // reserved space outside views for dimension lines
const VIEW_GAP = 50         // horizontal/vertical gap between views
const VIEW_TITLE_GAP = 18   // space between view title and view frame
const MARGIN = 40           // outer page margin
const TITLE_H = 52          // top title block height
const LEGEND_LINE = 14      // line height in legend table
const INFO_H = 55           // bottom info block height

// ─── Dimension line ───────────────────────────────────────────────────────────

function dimLine(
  x1: number, y1: number, x2: number, y2: number,
  label: string, side: 'top' | 'bottom' | 'left' | 'right',
): string {
  const isH = side === 'top' || side === 'bottom'
  const away = side === 'top' || side === 'left' ? -DIM_SPACE + 6 : DIM_SPACE - 6

  let lx1: number, ly1: number, lx2: number, ly2: number
  let tx: number, ty: number, anc: string, rot = ''

  if (isH) {
    lx1 = x1; ly1 = y1 + away; lx2 = x2; ly2 = y2 + away
    tx = (lx1 + lx2) / 2; ty = ly1 - 5; anc = 'middle'
  } else {
    lx1 = x1 + away; ly1 = y1; lx2 = x2 + away; ly2 = y2
    tx = lx1 + (away > 0 ? 6 : -6); ty = (ly1 + ly2) / 2; anc = 'middle'
    rot = ` transform="rotate(-90 ${tx} ${ty})"`
  }

  // Extension whiskers
  const w = (v: number) => (v > 0 ? 3 : -3)
  const e1 = isH
    ? `<line x1="${x1}" y1="${y1}" x2="${lx1}" y2="${ly1 + w(away)}" stroke="${DIM_COLOR}" stroke-width="0.35" stroke-dasharray="2,1"/>`
    : `<line x1="${x1}" y1="${y1}" x2="${lx1 + w(away)}" y2="${ly1}" stroke="${DIM_COLOR}" stroke-width="0.35" stroke-dasharray="2,1"/>`
  const e2 = isH
    ? `<line x1="${x2}" y1="${y2}" x2="${lx2}" y2="${ly2 + w(away)}" stroke="${DIM_COLOR}" stroke-width="0.35" stroke-dasharray="2,1"/>`
    : `<line x1="${x2}" y1="${y2}" x2="${lx2 + w(away)}" y2="${ly2}" stroke="${DIM_COLOR}" stroke-width="0.35" stroke-dasharray="2,1"/>`

  // Arrows
  const a1 = isH
    ? `M${lx1},${ly1} l${ARROW},${-ARROW / 2} l0,${ARROW} z`
    : `M${lx1},${ly1} l${-ARROW / 2},${ARROW} l${ARROW},0 z`
  const a2 = isH
    ? `M${lx2},${ly2} l${-ARROW},${-ARROW / 2} l0,${ARROW} z`
    : `M${lx2},${ly2} l${-ARROW / 2},${-ARROW} l${ARROW},0 z`

  return [
    e1, e2,
    `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="${DIM_COLOR}" stroke-width="0.5"/>`,
    `<path d="${a1}" fill="${DIM_COLOR}"/>`,
    `<path d="${a2}" fill="${DIM_COLOR}"/>`,
    `<text x="${tx}" y="${ty}" text-anchor="${anc}" font-family="${FONT}" font-size="${DIM_FONT}" font-weight="600" fill="${DIM_COLOR}"${rot}>${label}</text>`,
  ].join('\n')
}

// ─── Draw a single orthographic view ──────────────────────────────────────────

function drawOrthoView(
  parts: string[],
  pieces: InteractivePiece[],
  ox: number, oy: number,
  viewW: number, viewH: number,
  mapper: (p: InteractivePiece) => { x: number; y: number; w: number; h: number },
  title: string,
  dims: { wLabel: string; hLabel: string },
) {
  // Title
  parts.push(`<text x="${ox + viewW / 2}" y="${oy - VIEW_TITLE_GAP}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="#475569">${title}</text>`)

  // Frame
  parts.push(`<rect x="${ox}" y="${oy}" width="${viewW}" height="${viewH}" fill="#fafafa" stroke="#94a3b8" stroke-width="0.6"/>`)

  // Pieces
  for (const p of pieces) {
    const c = PIECE_COLORS[p.type]
    const { x: rx, y: ry, w: rw, h: rh } = mapper(p)
    if (rw < 1 || rh < 1) continue
    const px = ox + rx, py = oy + ry
    const fill = p.type === 'frontal' ? 'rgba(59,130,246,0.08)' : 'rgba(148,163,184,0.08)'
    const dash = p.type === 'trasera' ? ' stroke-dasharray="4,2"' : ''
    parts.push(`<rect x="${px}" y="${py}" width="${rw}" height="${rh}" rx="1" fill="${fill}" stroke="${c.stroke}" stroke-width="0.7"${dash}/>`)

    // Label only if enough room
    if (rw > 28 && rh > 16) {
      parts.push(`<text x="${px + rw / 2}" y="${py + rh / 2 + 3}" text-anchor="middle" font-family="${FONT}" font-size="7.5" font-weight="600" fill="#334155">${p.name}</text>`)
    }
  }

  // Dimension lines — placed OUTSIDE frame (top + right) so they never overlap pieces
  parts.push(dimLine(ox, oy, ox + viewW, oy, dims.wLabel, 'top'))
  parts.push(dimLine(ox + viewW, oy, ox + viewW, oy + viewH, dims.hLabel, 'right'))
}

// ─── Isometric helpers ────────────────────────────────────────────────────────

const COS30 = Math.cos(Math.PI / 6) // ≈ 0.866
const SIN30 = 0.5

/** Project (x,y,z) in furniture-space to 2D isometric screen coords. */
function iso(x: number, y: number, z: number): { sx: number; sy: number } {
  return {
    sx: (x - z) * COS30,
    sy: -(y) + (x + z) * SIN30,
  }
}

function drawIsometricView(
  parts: string[],
  pieces: InteractivePiece[],
  mod: ModuleDimensions,
  ox: number, oy: number,
  isoW: number, isoH: number,
) {
  // Title
  parts.push(`<text x="${ox + isoW / 2}" y="${oy - VIEW_TITLE_GAP}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="#475569">ISOMÉTRICA</text>`)

  // Frame
  parts.push(`<rect x="${ox}" y="${oy}" width="${isoW}" height="${isoH}" fill="#fafafa" stroke="#94a3b8" stroke-width="0.6"/>`)

  // Compute bounding box of all isometric projections
  const allCorners: { sx: number; sy: number }[] = []
  for (const p of pieces) {
    for (const [dx, dy, dz] of [[0,0,0],[p.w,0,0],[0,p.h,0],[0,0,p.d],[p.w,p.h,0],[p.w,0,p.d],[0,p.h,p.d],[p.w,p.h,p.d]]) {
      allCorners.push(iso(p.x + dx, p.y + dy, p.z + dz))
    }
  }
  // Also module bounding box
  for (const [dx, dy, dz] of [[0,0,0],[mod.width,0,0],[0,mod.height,0],[0,0,mod.depth],[mod.width,mod.height,mod.depth]]) {
    allCorners.push(iso(dx, dy, dz))
  }
  const minSx = Math.min(...allCorners.map(c => c.sx))
  const maxSx = Math.max(...allCorners.map(c => c.sx))
  const minSy = Math.min(...allCorners.map(c => c.sy))
  const maxSy = Math.max(...allCorners.map(c => c.sy))
  const bboxW = maxSx - minSx
  const bboxH = maxSy - minSy

  // Scale to fit inside the isometric frame with padding
  const pad = 20
  const availW = isoW - pad * 2
  const availH = isoH - pad * 2
  const scale = Math.min(availW / Math.max(bboxW, 1), availH / Math.max(bboxH, 1), 1)

  // Origin in SVG coords so the iso drawing is centered in the frame
  const centSx = (minSx + maxSx) / 2
  const centSy = (minSy + maxSy) / 2
  const cxSvg = ox + isoW / 2
  const cySvg = oy + isoH / 2

  function toSvg(sx: number, sy: number): { x: number; y: number } {
    return {
      x: cxSvg + (sx - centSx) * scale,
      y: cySvg - (sy - centSy) * scale,  // flip Y for SVG
    }
  }

  // Sort pieces by depth to draw back-to-front
  const sorted = [...pieces].sort((a, b) => {
    const da = a.x + a.y + a.z
    const db = b.x + b.y + b.z
    return da - db
  })

  for (const p of sorted) {
    const c = PIECE_COLORS[p.type]
    const isDashed = p.type === 'trasera'

    // 8 projected corners
    const c000 = iso(p.x, p.y, p.z)
    const c100 = iso(p.x + p.w, p.y, p.z)
    const c010 = iso(p.x, p.y + p.h, p.z)
    const c110 = iso(p.x + p.w, p.y + p.h, p.z)
    const c001 = iso(p.x, p.y, p.z + p.d)
    const c101 = iso(p.x + p.w, p.y, p.z + p.d)
    const c011 = iso(p.x, p.y + p.h, p.z + p.d)
    const c111 = iso(p.x + p.w, p.y + p.h, p.z + p.d)

    // Convert to SVG coords
    const s = (...cs: { sx: number; sy: number }[]) => cs.map(v => toSvg(v.sx, v.sy))

    // Three visible faces as polygons (properly projected via toSvg)
    const topPts = s(c010, c110, c111, c011).map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')
    const frontPts = s(c000, c100, c110, c010).map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')
    const rightPts = s(c100, c101, c111, c110).map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')

    const dashAttr = isDashed ? ' stroke-dasharray="3,2"' : ''
    // Front face (most opaque)
    parts.push(`<polygon points="${frontPts}" fill="${c.fill}" fill-opacity="0.12" stroke="${c.stroke}" stroke-width="0.6"${dashAttr}/>`)
    // Right face
    parts.push(`<polygon points="${rightPts}" fill="${c.fill}" fill-opacity="0.08" stroke="${c.stroke}" stroke-width="0.6"${dashAttr}/>`)
    // Top face (lightest)
    parts.push(`<polygon points="${topPts}" fill="${c.fill}" fill-opacity="0.18" stroke="${c.stroke}" stroke-width="0.6"${dashAttr}/>`)

    // Label on front face center if enough space
    const fc = s(c000, c100, c110, c010)
    const fcx = (fc[0].x + fc[1].x + fc[2].x + fc[3].x) / 4
    const fcy = (fc[0].y + fc[1].y + fc[2].y + fc[3].y) / 4
    const faceW = Math.abs(fc[1].x - fc[0].x)
    const faceH = Math.abs(fc[3].y - fc[0].y)
    if (faceW > 25 && faceH > 14) {
      parts.push(`<text x="${fcx.toFixed(1)}" y="${fcy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="7" font-weight="600" fill="#1e293b">${p.name}</text>`)
    }
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateBlueprintSVG(opts: BlueprintOptions): string {
  const { pieces, module: mod, itemName, projectInfo, catalogMaterials = [] } = opts
  const vis = pieces.filter(p => !p.hidden)

  const matMap = new Map(catalogMaterials.map(m => [m.id, m]))
  const defaultMat = mod.catalogMaterialId ? matMap.get(mod.catalogMaterialId) : undefined

  // ─── Layout ─────────────────────────────────────────────────────────────
  //
  //  Row 1:  ALZADO (w×h)  |gap|  PERFIL (d×h)
  //  Row 2:  PLANTA (w×d)  |gap|  ISOMÉTRICA
  //  Row 3:  ─── LEYENDA PIEZAS (tabla) ───
  //  Row 4:  ─── INFO BLOCK ───

  const alzW = mod.width, alzH = mod.height
  const perW = mod.depth, perH = mod.height
  const pltW = mod.width, pltH = mod.depth

  // Isometric view sized to match the right column
  const isoW = Math.max(perW, mod.depth + mod.width * 0.6)
  const isoH = Math.max(pltH, mod.height * 0.6 + mod.depth * 0.3)

  // Row 1 includes DIM_SPACE above (for top dim line) + view + DIM_SPACE right
  const row1ViewH = Math.max(alzH, perH)
  const row1TotalH = VIEW_TITLE_GAP + row1ViewH + DIM_SPACE

  // Row 2
  const row2ViewH = Math.max(pltH, isoH)
  const row2TotalH = VIEW_TITLE_GAP + row2ViewH + DIM_SPACE

  // Right column width: max(perfil, iso) + right DIM_SPACE
  const leftColW = alzW + DIM_SPACE            // alzado + right dim
  const rightColW = Math.max(perW, isoW) + DIM_SPACE

  const contentW = leftColW + VIEW_GAP + rightColW
  const contentH = row1TotalH + VIEW_GAP + row2TotalH

  // Legend: one row per piece
  const legendRows = vis.length
  const legendH = 20 + legendRows * LEGEND_LINE + 10

  const svgW = contentW + MARGIN * 2
  const svgH = TITLE_H + contentH + legendH + INFO_H + MARGIN * 2

  const parts: string[] = []

  // Background
  parts.push(`<rect width="${svgW}" height="${svgH}" fill="white"/>`)

  // ─── Title block ────────────────────────────────────────────────────────
  parts.push(`<text x="${svgW / 2}" y="${MARGIN + 18}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="700" fill="#0f172a">${itemName}</text>`)
  if (projectInfo) {
    parts.push(`<text x="${svgW / 2}" y="${MARGIN + 34}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#64748b">${projectInfo}</text>`)
  }

  const baseY = MARGIN + TITLE_H

  // ─── Row 1: Alzado + Perfil ─────────────────────────────────────────────

  const r1y = baseY + DIM_SPACE + VIEW_TITLE_GAP // top of view rects

  // Alzado
  drawOrthoView(parts, vis, MARGIN, r1y, alzW, alzH,
    p => ({ x: p.x, y: alzH - p.y - p.h, w: p.w, h: p.h }),
    'ALZADO (frontal)',
    { wLabel: `${mod.width}`, hLabel: `${mod.height}` },
  )

  // Perfil
  const perOx = MARGIN + leftColW + VIEW_GAP
  drawOrthoView(parts, vis, perOx, r1y, perW, perH,
    p => ({ x: p.z, y: perH - p.y - p.h, w: p.d, h: p.h }),
    'PERFIL (lateral)',
    { wLabel: `${mod.depth}`, hLabel: `${mod.height}` },
  )

  // ─── Row 2: Planta + Isométrica ─────────────────────────────────────────

  const r2y = r1y + row1ViewH + DIM_SPACE + VIEW_GAP + VIEW_TITLE_GAP

  // Planta
  drawOrthoView(parts, vis, MARGIN, r2y, pltW, pltH,
    p => ({ x: p.x, y: p.z, w: p.w, h: p.d }),
    'PLANTA (superior)',
    { wLabel: `${mod.width}`, hLabel: `${mod.depth}` },
  )

  // Isométrica
  drawIsometricView(parts, vis, mod, perOx, r2y, Math.max(perW, isoW), Math.max(pltH, isoH))

  // ─── Legend table ───────────────────────────────────────────────────────

  const legY = r2y + row2ViewH + DIM_SPACE + 15
  parts.push(`<line x1="${MARGIN}" y1="${legY}" x2="${svgW - MARGIN}" y2="${legY}" stroke="#cbd5e1" stroke-width="0.5"/>`)
  parts.push(`<text x="${MARGIN + 4}" y="${legY + 14}" font-family="${FONT}" font-size="9" font-weight="700" fill="#334155">LISTADO DE PIEZAS</text>`)

  // Header
  const colX = { num: MARGIN + 4, name: MARGIN + 24, dim: MARGIN + 130, type: MARGIN + 220, mat: MARGIN + 290 }
  const hdrY = legY + 26
  parts.push(`<text x="${colX.num}" y="${hdrY}" font-family="${FONT}" font-size="7.5" font-weight="700" fill="#64748b">Nº</text>`)
  parts.push(`<text x="${colX.name}" y="${hdrY}" font-family="${FONT}" font-size="7.5" font-weight="700" fill="#64748b">Pieza</text>`)
  parts.push(`<text x="${colX.dim}" y="${hdrY}" font-family="${FONT}" font-size="7.5" font-weight="700" fill="#64748b">Ancho×Alto×Fondo</text>`)
  parts.push(`<text x="${colX.type}" y="${hdrY}" font-family="${FONT}" font-size="7.5" font-weight="700" fill="#64748b">Tipo</text>`)
  parts.push(`<text x="${colX.mat}" y="${hdrY}" font-family="${FONT}" font-size="7.5" font-weight="700" fill="#64748b">Material</text>`)

  let ly = hdrY + LEGEND_LINE
  vis.forEach((p, i) => {
    const pMat = p.materialId ? matMap.get(p.materialId) : defaultMat
    const c = PIECE_COLORS[p.type]
    // Alternating row background
    if (i % 2 === 0) {
      parts.push(`<rect x="${MARGIN}" y="${ly - 9}" width="${svgW - MARGIN * 2}" height="${LEGEND_LINE}" fill="#f8fafc"/>`)
    }
    parts.push(`<rect x="${colX.num}" y="${ly - 6}" width="6" height="6" rx="1" fill="${c.stroke}" opacity="0.4"/>`)
    parts.push(`<text x="${colX.num + 10}" y="${ly}" font-family="${FONT}" font-size="7.5" fill="#475569">${i + 1}</text>`)
    parts.push(`<text x="${colX.name}" y="${ly}" font-family="${FONT}" font-size="7.5" font-weight="600" fill="#1e293b">${p.name}</text>`)
    parts.push(`<text x="${colX.dim}" y="${ly}" font-family="${FONT}" font-size="7.5" fill="#475569">${Math.round(p.w)} × ${Math.round(p.h)} × ${Math.round(p.d)} mm</text>`)
    parts.push(`<text x="${colX.type}" y="${ly}" font-family="${FONT}" font-size="7.5" fill="#475569">${c.label}</text>`)
    parts.push(`<text x="${colX.mat}" y="${ly}" font-family="${FONT}" font-size="7.5" fill="#475569">${pMat?.name || '—'}</text>`)
    ly += LEGEND_LINE
  })

  // ─── Info block ─────────────────────────────────────────────────────────

  const infoY = svgH - INFO_H - MARGIN + 10
  parts.push(`<line x1="${MARGIN}" y1="${infoY - 5}" x2="${svgW - MARGIN}" y2="${infoY - 5}" stroke="#cbd5e1" stroke-width="0.5"/>`)

  const matName = defaultMat?.name || 'Sin material'
  const th = mod.thickness || 16
  parts.push(`<text x="${MARGIN + 4}" y="${infoY + 10}" font-family="${FONT}" font-size="8.5" font-weight="600" fill="#334155">Material: ${matName} (${th}mm) · Tipo: ${mod.type} · ${vis.length} piezas · ${mod.width}×${mod.height}×${mod.depth} mm</text>`)

  const estr = vis.filter(p => p.type === 'estructura').length
  const fron = vis.filter(p => p.type === 'frontal').length
  const tras = vis.filter(p => p.type === 'trasera').length
  parts.push(`<text x="${MARGIN + 4}" y="${infoY + 24}" font-family="${FONT}" font-size="7.5" fill="#94a3b8">Estructura: ${estr} · Frontal: ${fron} · Trasera: ${tras} · Acotado en mm</text>`)

  const now = new Date()
  const ts = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
  parts.push(`<text x="${svgW - MARGIN - 4}" y="${infoY + 10}" text-anchor="end" font-family="${FONT}" font-size="7.5" fill="#94a3b8">${ts}</text>`)
  parts.push(`<text x="${svgW - MARGIN - 4}" y="${infoY + 24}" text-anchor="end" font-family="${FONT}" font-size="7.5" fill="#94a3b8">VanSpace Workshop</text>`)

  // ─── Assemble ───────────────────────────────────────────────────────────

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`,
    ...parts,
    '</svg>',
  ].join('\n')
}
