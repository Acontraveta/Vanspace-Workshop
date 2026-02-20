import { Piece, PlacedPiece } from '../types/furniture.types'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/furniture.constants'

/**
 * Shelf-packing algorithm for cut-list optimisation.
 * Sorts pieces by descending height and packs them row by row onto a single board.
 * Multi-board support: if a piece doesn't fit on the current board, starts a new one.
 */
export function optimizeCutList(pieces: Piece[]): PlacedPiece[] {
  const sorted = [...pieces].sort((a, b) => b.h - a.h)
  const placements: PlacedPiece[] = []

  let currentX       = 0
  let currentY       = 0
  let currentRowH    = 0
  let boardOffsetY   = 0   // offset so extra boards appear below the first

  for (const piece of sorted) {
    // Doesn't fit remaining row width → wrap to next row
    if (currentX + piece.w > BOARD_WIDTH) {
      currentX   = 0
      currentY  += currentRowH
      currentRowH = 0
    }

    // Doesn't fit board height → start a new board
    if (currentY + piece.h > BOARD_HEIGHT) {
      boardOffsetY += BOARD_HEIGHT + 80  // 80 mm gap between boards in the view
      currentX    = 0
      currentY    = 0
      currentRowH = 0
    }

    placements.push({
      ...piece,
      x: currentX,
      y: boardOffsetY + currentY,
    })

    currentX      += piece.w
    currentRowH    = Math.max(currentRowH, piece.h)
  }

  return placements
}

/** How many boards are needed to fit all placed pieces */
export function boardCount(placements: PlacedPiece[]): number {
  if (!placements.length) return 0
  const maxY = Math.max(...placements.map(p => p.y + p.h))
  return Math.ceil(maxY / (BOARD_HEIGHT + 80))
}
