// ─── Cut-list SVG Generator ───────────────────────────────────────────────────
// Generates a static SVG image of the optimised cut-list boards, grouped by
// material, exactly like FurnitureOptimizerView but as a serialisable string.
// Stored on the FurnitureWorkOrder and shown to the operator for board cutting.

import { PlacedPiece } from '../types/furniture.types'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/furniture.constants'
import { boardCount, boardWaste } from './geometry'

const FONT = 'Arial, Helvetica, sans-serif'

interface MaterialGroup {
  materialId: string
  materialName: string
  boards: number[]
  pieces: PlacedPiece[]
}

function groupByMaterial(placements: PlacedPiece[]): MaterialGroup[] {
  const map = new Map<string, MaterialGroup>()
  for (const p of placements) {
    const key = p.materialId || '__default__'
    let group = map.get(key)
    if (!group) {
      group = { materialId: key, materialName: p.materialName || 'Material por defecto', boards: [], pieces: [] }
      map.set(key, group)
    }
    group.pieces.push(p)
    const bi = p.board ?? 0
    if (!group.boards.includes(bi)) group.boards.push(bi)
  }
  for (const g of map.values()) g.boards.sort((a, b) => a - b)
  return Array.from(map.values())
}

export function generateCutlistSVG(placements: PlacedPiece[], projectInfo?: string): string {
  if (!placements.length) return ''

  const groups = groupByMaterial(placements)
  const totalBoards = boardCount(placements)

  // Layout constants
  const SCALE = 0.28          // mm → SVG units (fits ~680px wide)
  const BOARD_SVG_W = BOARD_WIDTH * SCALE
  const BOARD_SVG_H = BOARD_HEIGHT * SCALE
  const MARGIN = 20
  const BOARD_GAP = 16
  const HEADER_H = 30
  const GROUP_GAP = 24
  const TITLE_H = 55

  // Calculate total height
  let totalH = TITLE_H + MARGIN
  for (const group of groups) {
    if (groups.length > 1) totalH += HEADER_H
    totalH += group.boards.length * (BOARD_SVG_H + BOARD_GAP + 14) // 14 for board label
    totalH += GROUP_GAP
  }
  totalH += 40 // footer

  const svgW = BOARD_SVG_W + MARGIN * 2

  const parts: string[] = []

  // Background
  parts.push(`<rect x="0" y="0" width="${svgW}" height="${totalH}" fill="white"/>`)

  // Title
  parts.push(`<text x="${svgW / 2}" y="24" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="#0f172a">Despiece Total — ${totalBoards} tablero${totalBoards !== 1 ? 's' : ''}</text>`)
  if (projectInfo) {
    parts.push(`<text x="${svgW / 2}" y="40" text-anchor="middle" font-family="${FONT}" font-size="9" fill="#64748b">${projectInfo} · ${BOARD_WIDTH}×${BOARD_HEIGHT} mm · ${placements.length} piezas</text>`)
  }

  // Utilization summary
  const totalUsed = placements.reduce((s, p) => s + p.w * p.h, 0)
  const totalArea = totalBoards * BOARD_WIDTH * BOARD_HEIGHT
  const utilPct = Math.round((totalUsed / totalArea) * 100)
  parts.push(`<text x="${svgW - MARGIN}" y="24" text-anchor="end" font-family="${FONT}" font-size="10" font-weight="600" fill="${utilPct >= 85 ? '#059669' : '#d97706'}">${utilPct}% aprovechamiento</text>`)

  let curY = TITLE_H

  for (const group of groups) {
    // Material header
    if (groups.length > 1) {
      parts.push(`<text x="${MARGIN}" y="${curY + 16}" font-family="${FONT}" font-size="11" font-weight="700" fill="#334155">${group.materialName}</text>`)
      parts.push(`<text x="${svgW - MARGIN}" y="${curY + 16}" text-anchor="end" font-family="${FONT}" font-size="9" fill="#94a3b8">${group.boards.length} tablero${group.boards.length !== 1 ? 's' : ''} · ${group.pieces.length} piezas</text>`)
      parts.push(`<line x1="${MARGIN}" y1="${curY + 22}" x2="${svgW - MARGIN}" y2="${curY + 22}" stroke="#e2e8f0" stroke-width="0.5"/>`)
      curY += HEADER_H
    }

    // Boards
    for (let localIdx = 0; localIdx < group.boards.length; localIdx++) {
      const bi = group.boards[localIdx]
      const boardPieces = group.pieces.filter(p => (p.board ?? 0) === bi)
      const waste = boardWaste(boardPieces)

      // Board label
      const boardLabel = groups.length > 1
        ? `Tablero ${localIdx + 1}`
        : (totalBoards > 1 ? `Tablero ${bi + 1}` : '')
      if (boardLabel) {
        parts.push(`<text x="${MARGIN}" y="${curY + 10}" font-family="${FONT}" font-size="8" font-weight="700" fill="#94a3b8">${boardLabel}</text>`)
      }
      const wasteColor = waste > 30 ? '#d97706' : '#059669'
      parts.push(`<text x="${svgW - MARGIN}" y="${curY + 10}" text-anchor="end" font-family="${FONT}" font-size="8" font-weight="600" fill="${wasteColor}">Desperdicio ${waste}%</text>`)
      curY += 14

      // Board rect
      const bx = MARGIN
      const by = curY
      parts.push(`<rect x="${bx}" y="${by}" width="${BOARD_SVG_W}" height="${BOARD_SVG_H}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="2"/>`)

      // Pieces
      for (const p of boardPieces) {
        const px = bx + p.x * SCALE
        const py = by + p.y * SCALE
        const pw = p.w * SCALE
        const ph = p.h * SCALE

        const fill = p.rotated ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.08)'
        const stroke = p.rotated ? '#8b5cf6' : '#3b82f6'
        parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`)

        // Ref label
        if (pw > 35 && ph > 16) {
          const fontSize = Math.min(7, pw / 12)
          const textFill = p.rotated ? '#6d28d9' : '#1d4ed8'
          parts.push(`<text x="${px + pw / 2}" y="${py + ph / 2 - 3}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${fontSize}" font-weight="600" fill="${textFill}">${p.ref}</text>`)
        }

        // Dimensions
        if (pw > 35 && ph > 24) {
          const dimFill = p.rotated ? '#8b5cf6' : '#3b82f6'
          parts.push(`<text x="${px + pw / 2}" y="${py + ph / 2 + 7}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="5.5" fill="${dimFill}">${p.w}×${p.h}${p.rotated ? ' ↻' : ''}</text>`)
        }
      }

      curY += BOARD_SVG_H + BOARD_GAP
    }

    curY += GROUP_GAP
  }

  // Timestamp footer
  const now = new Date()
  const ts = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
  parts.push(`<text x="${MARGIN}" y="${curY}" font-family="${FONT}" font-size="7" fill="#94a3b8">${ts} · VanSpace Workshop</text>`)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(svgW)}" height="${Math.round(curY + 10)}" viewBox="0 0 ${Math.round(svgW)} ${Math.round(curY + 10)}">`,
    ...parts,
    '</svg>',
  ].join('\n')
}
