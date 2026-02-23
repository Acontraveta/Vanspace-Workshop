// ─── Cut-list SVG Generator ───────────────────────────────────────────────────
// Generates a static SVG image of the optimised cut-list boards, grouped by
// material, exactly like FurnitureOptimizerView but as a serialisable string.
// Stored on the FurnitureWorkOrder and shown to the operator for board cutting.
//
// Each piece shows its ref name centred, with the WIDTH dimension along the
// top/bottom edge and the HEIGHT dimension along the left/right edge — exactly
// how a workshop operator would read a cutting plan.

import { PlacedPiece } from '../types/furniture.types'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/furniture.constants'
import { boardCount, boardWaste } from './geometry'

const FONT = 'Arial, Helvetica, sans-serif'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Escape XML entities in text content */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateCutlistSVG(placements: PlacedPiece[], projectInfo?: string): string {
  if (!placements.length) return ''

  const groups = groupByMaterial(placements)
  const totalBoards = boardCount(placements)

  // Layout constants — larger scale for readability
  const SCALE = 0.38          // mm → SVG units (fits ~930px wide)
  const BOARD_SVG_W = BOARD_WIDTH * SCALE
  const BOARD_SVG_H = BOARD_HEIGHT * SCALE
  const MARGIN = 24
  const BOARD_GAP = 22
  const HEADER_H = 34
  const GROUP_GAP = 28
  const TITLE_H = 60
  const DIM_PAD = 3           // padding inside piece rect for dimension text

  // Calculate total height
  let totalH = TITLE_H + MARGIN
  for (const group of groups) {
    if (groups.length > 1) totalH += HEADER_H
    totalH += group.boards.length * (BOARD_SVG_H + BOARD_GAP + 18)
    totalH += GROUP_GAP
  }
  totalH += 50 // footer + piece list

  const svgW = BOARD_SVG_W + MARGIN * 2

  const parts: string[] = []

  // Background
  parts.push(`<rect x="0" y="0" width="${svgW}" height="${totalH}" fill="white"/>`)

  // Title
  parts.push(`<text x="${svgW / 2}" y="26" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="#0f172a">Despiece Total — ${totalBoards} tablero${totalBoards !== 1 ? 's' : ''}</text>`)
  if (projectInfo) {
    parts.push(`<text x="${svgW / 2}" y="44" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#64748b">${esc(projectInfo)} · Tablero ${BOARD_WIDTH}×${BOARD_HEIGHT} mm · ${placements.length} piezas</text>`)
  }

  // Utilization summary
  const totalUsed = placements.reduce((s, p) => s + p.w * p.h, 0)
  const totalArea = totalBoards * BOARD_WIDTH * BOARD_HEIGHT
  const utilPct = Math.round((totalUsed / totalArea) * 100)
  parts.push(`<text x="${svgW - MARGIN}" y="26" text-anchor="end" font-family="${FONT}" font-size="12" font-weight="700" fill="${utilPct >= 85 ? '#059669' : '#d97706'}">${utilPct}% aprovechamiento</text>`)

  let curY = TITLE_H

  for (const group of groups) {
    // Material header
    if (groups.length > 1) {
      parts.push(`<text x="${MARGIN}" y="${curY + 18}" font-family="${FONT}" font-size="12" font-weight="700" fill="#334155">${esc(group.materialName)}</text>`)
      parts.push(`<text x="${svgW - MARGIN}" y="${curY + 18}" text-anchor="end" font-family="${FONT}" font-size="10" fill="#94a3b8">${group.boards.length} tablero${group.boards.length !== 1 ? 's' : ''} · ${group.pieces.length} piezas</text>`)
      parts.push(`<line x1="${MARGIN}" y1="${curY + 26}" x2="${svgW - MARGIN}" y2="${curY + 26}" stroke="#cbd5e1" stroke-width="0.8"/>`)
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
        : (totalBoards > 1 ? `Tablero ${bi + 1}` : 'Tablero único')
      parts.push(`<text x="${MARGIN}" y="${curY + 12}" font-family="${FONT}" font-size="10" font-weight="700" fill="#64748b">${boardLabel}</text>`)
      const wasteColor = waste > 30 ? '#d97706' : '#059669'
      parts.push(`<text x="${svgW - MARGIN}" y="${curY + 12}" text-anchor="end" font-family="${FONT}" font-size="10" font-weight="600" fill="${wasteColor}">Desperdicio ${waste}%</text>`)
      curY += 18

      // Board rect
      const bx = MARGIN
      const by = curY
      parts.push(`<rect x="${bx}" y="${by}" width="${BOARD_SVG_W}" height="${BOARD_SVG_H}" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" rx="3"/>`)

      // Board overall dims
      parts.push(`<text x="${bx + BOARD_SVG_W / 2}" y="${by - 3}" text-anchor="middle" font-family="${FONT}" font-size="8" fill="#94a3b8">${BOARD_WIDTH} mm</text>`)
      parts.push(`<text x="${bx - 4}" y="${by + BOARD_SVG_H / 2}" text-anchor="end" font-family="${FONT}" font-size="8" fill="#94a3b8" transform="rotate(-90 ${bx - 4} ${by + BOARD_SVG_H / 2})">${BOARD_HEIGHT} mm</text>`)

      // ─── Pieces on this board ───────────────────────────────────────────
      for (let j = 0; j < boardPieces.length; j++) {
        const p = boardPieces[j]
        const px = bx + p.x * SCALE
        const py = by + p.y * SCALE
        const pw = p.w * SCALE
        const ph = p.h * SCALE
        const clipId = `c${bi}-${j}`

        // Piece rect
        const fill = p.rotated ? 'rgba(139,92,246,0.10)' : 'rgba(59,130,246,0.08)'
        const stroke = p.rotated ? '#8b5cf6' : '#2563eb'
        parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`)

        // Clip so no text overflows the piece
        parts.push(`<clipPath id="${clipId}"><rect x="${px}" y="${py}" width="${pw}" height="${ph}"/></clipPath>`)
        parts.push(`<g clip-path="url(#${clipId})">`)

        // ─ Dimensions ─────────────────────────────────────────────────────
        const dimW = Math.round(p.w)
        const dimH = Math.round(p.h)
        const dimColor = p.rotated ? '#7c3aed' : '#2563eb'
        const dimFontSize = Math.min(7, Math.max(4.5, pw / 16))

        // Space reserved by dimension labels
        const topReserve  = (pw > 22) ? dimFontSize + DIM_PAD * 2 : 0
        const rightReserve = (ph > 22) ? dimFontSize * 1.4 + DIM_PAD * 2 : 0

        // Width dimension (top edge, horizontal)
        if (pw > 22) {
          parts.push(`<text x="${px + pw / 2}" y="${py + DIM_PAD + dimFontSize}" text-anchor="middle" font-family="${FONT}" font-size="${dimFontSize.toFixed(1)}" font-weight="600" fill="${dimColor}">${dimW}</text>`)
        }

        // Height dimension (right edge, vertical)
        if (ph > 22) {
          const rx = px + pw - DIM_PAD - dimFontSize * 0.4
          const ry = py + ph / 2
          parts.push(`<text x="${rx}" y="${ry}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${dimFontSize.toFixed(1)}" font-weight="600" fill="${dimColor}" transform="rotate(-90 ${rx} ${ry})">${dimH}</text>`)
        }

        // ─ Ref name (auto-sized to fit available space) ────────────────────
        const availW = pw - rightReserve - 2  // 2px inner margin
        const availH = ph - topReserve - 2
        if (availW > 10 && availH > 6) {
          const textFill = p.rotated ? '#6d28d9' : '#1e3a8a'
          const cx = px + (pw - rightReserve) / 2
          const cy = py + topReserve + availH / 2 + 1
          // Auto-size: shrink font until text fits (char ~0.6em wide)
          const maxFont = Math.min(8, availH * 0.7)
          let fontSize = maxFont
          let label = p.ref
          const charW = 0.6
          // Shrink font to fit full name, min 3px
          fontSize = Math.min(maxFont, availW / (label.length * charW))
          if (fontSize < 3) {
            // Too small — truncate to fit at 3px
            fontSize = 3
            const fitChars = Math.floor(availW / (fontSize * charW))
            label = fitChars >= label.length ? label : label.slice(0, Math.max(1, fitChars - 1)) + '…'
          }
          parts.push(`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="${fontSize.toFixed(1)}" font-weight="700" fill="${textFill}">${esc(label)}</text>`)
        }

        // Rotation indicator
        if (p.rotated && pw > 24 && ph > 24) {
          parts.push(`<text x="${px + pw - 6}" y="${py + ph - 4}" font-family="${FONT}" font-size="7" fill="#8b5cf6">↻</text>`)
        }

        parts.push(`</g>`)
      }

      curY += BOARD_SVG_H + BOARD_GAP
    }

    curY += GROUP_GAP
  }

  // ─── Piece list table ───────────────────────────────────────────────────────
  parts.push(`<line x1="${MARGIN}" y1="${curY}" x2="${svgW - MARGIN}" y2="${curY}" stroke="#e2e8f0" stroke-width="0.5"/>`)
  curY += 14
  parts.push(`<text x="${MARGIN}" y="${curY}" font-family="${FONT}" font-size="9" font-weight="700" fill="#334155">Lista de piezas</text>`)
  curY += 4

  // Two-column piece table
  const colW = (svgW - MARGIN * 2) / 2
  placements.forEach((p, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const tx = MARGIN + col * colW
    const ty = curY + row * 11 + 11
    const rotMark = p.rotated ? ' ↻' : ''
    parts.push(`<text x="${tx}" y="${ty}" font-family="${FONT}" font-size="7" fill="#475569"><tspan font-weight="600">${esc(p.ref)}</tspan>  ${p.w}×${p.h}${rotMark}</text>`)
  })
  const listRows = Math.ceil(placements.length / 2)
  curY += listRows * 11 + 16

  // Timestamp footer
  const now = new Date()
  const ts = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
  parts.push(`<text x="${MARGIN}" y="${curY}" font-family="${FONT}" font-size="8" fill="#94a3b8">${ts} · VanSpace Workshop</text>`)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(svgW)}" height="${Math.round(curY + 10)}" viewBox="0 0 ${Math.round(svgW)} ${Math.round(curY + 10)}">`,
    ...parts,
    '</svg>',
  ].join('\n')
}
