import { Piece, PlacedPiece } from '../types/furniture.types'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/furniture.constants'

// ─── Kerf (blade width) ──────────────────────────────────────────────────────
const KERF = 4 // mm – material lost per cut

// ─── Internal rectangle type ─────────────────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number }

// ─── Guillotine Bin ──────────────────────────────────────────────────────────
// Each bin represents one physical board.
// Uses Best Short Side Fit (BSSF) placement + Shorter Axis Split strategy.
// All cuts are guaranteed to be full-width guillotine cuts that can be made
// with a panel saw.

class GuillotineBin {
  freeRects: Rect[]
  placed: (Piece & { x: number; y: number; rotated: boolean })[] = []

  constructor(public w: number, public h: number) {
    this.freeRects = [{ x: 0, y: 0, w, h }]
  }

  /** Try to place a piece in this bin. Returns true on success. */
  place(piece: Piece): boolean {
    let bestScore = Infinity
    let bestIdx   = -1
    let bestRot   = false
    let bestPw    = 0
    let bestPh    = 0

    for (let i = 0; i < this.freeRects.length; i++) {
      const fr = this.freeRects[i]

      // Try original orientation
      const kw = piece.w + KERF
      const kh = piece.h + KERF
      if (kw <= fr.w && kh <= fr.h) {
        const score = Math.min(fr.w - kw, fr.h - kh) // BSSF: shortest leftover side
        if (score < bestScore) {
          bestScore = score; bestIdx = i; bestRot = false; bestPw = kw; bestPh = kh
        }
      }

      // Try rotated 90°
      const rkw = piece.h + KERF
      const rkh = piece.w + KERF
      if (rkw <= fr.w && rkh <= fr.h) {
        const score = Math.min(fr.w - rkw, fr.h - rkh)
        if (score < bestScore) {
          bestScore = score; bestIdx = i; bestRot = true; bestPw = rkw; bestPh = rkh
        }
      }
    }

    if (bestIdx === -1) return false

    const fr = this.freeRects[bestIdx]
    this.placed.push({
      ...piece,
      w: bestRot ? piece.h : piece.w,  // displayed dimensions after rotation
      h: bestRot ? piece.w : piece.h,
      x: fr.x,
      y: fr.y,
      rotated: bestRot,
    })

    // Split the free rectangle (guillotine cut)
    this.splitFreeRect(bestIdx, bestPw, bestPh)
    return true
  }

  /** Guillotine split using Shorter Axis strategy */
  private splitFreeRect(idx: number, pw: number, ph: number) {
    const fr = this.freeRects.splice(idx, 1)[0]

    const rightW  = fr.w - pw
    const bottomH = fr.h - ph

    // Shorter Axis Split: cut along the shorter remaining axis
    const splitHorizontal = fr.w <= fr.h

    if (splitHorizontal) {
      // ┌───────┬──────────┐
      // │ piece │  right   │
      // ├───────┴──────────┤  ← horizontal guillotine cut
      // │     bottom       │
      // └──────────────────┘
      if (rightW > KERF) {
        this.freeRects.push({ x: fr.x + pw, y: fr.y, w: rightW, h: ph })
      }
      if (bottomH > KERF) {
        this.freeRects.push({ x: fr.x, y: fr.y + ph, w: fr.w, h: bottomH })
      }
    } else {
      // ┌───────┬──────────┐
      // │ piece │          │
      // ├───────┤  right   │
      // │bottom │          │
      // └───────┴──────────┘
      //          ↑ vertical guillotine cut
      if (rightW > KERF) {
        this.freeRects.push({ x: fr.x + pw, y: fr.y, w: rightW, h: fr.h })
      }
      if (bottomH > KERF) {
        this.freeRects.push({ x: fr.x, y: fr.y + ph, w: pw, h: bottomH })
      }
    }

    // Merge adjacent free rects when possible to recover space
    this.mergeFreeRects()
  }

  /** Merge adjacent free rects that form a larger rectangle */
  private mergeFreeRects() {
    for (let i = 0; i < this.freeRects.length; i++) {
      for (let j = i + 1; j < this.freeRects.length; j++) {
        const a = this.freeRects[i]
        const b = this.freeRects[j]

        // Same X, same width, vertically adjacent
        if (a.x === b.x && a.w === b.w) {
          if (Math.abs(a.y + a.h - b.y) < 1) {
            a.h += b.h; this.freeRects.splice(j, 1); j--; continue
          }
          if (Math.abs(b.y + b.h - a.y) < 1) {
            a.y = b.y; a.h += b.h; this.freeRects.splice(j, 1); j--; continue
          }
        }
        // Same Y, same height, horizontally adjacent
        if (a.y === b.y && a.h === b.h) {
          if (Math.abs(a.x + a.w - b.x) < 1) {
            a.w += b.w; this.freeRects.splice(j, 1); j--; continue
          }
          if (Math.abs(b.x + b.w - a.x) < 1) {
            a.x = b.x; a.w += b.w; this.freeRects.splice(j, 1); j--; continue
          }
        }
      }
    }
  }

  /** Occupied area (piece dimensions only, no kerf) */
  get usedArea(): number {
    return this.placed.reduce((s, p) => s + p.w * p.h, 0)
  }

  /** Utilisation ratio 0..1 */
  get utilization(): number {
    return this.usedArea / (this.w * this.h)
  }
}

// ─── Multi-board Guillotine Optimiser ────────────────────────────────────────

/**
 * Guillotine bin-packing with Best Short Side Fit + Shorter Axis Split.
 * Supports piece rotation, 4 mm kerf, and multiple boards.
 *
 * Runs the packing in both board orientations (W×H and H×W) and returns
 * the result with fewer boards / higher utilisation.
 */
export function optimizeCutList(pieces: Piece[]): PlacedPiece[] {
  if (!pieces.length) return []

  // First Fit Decreasing – sort by area descending (critical for good packing)
  const sorted = [...pieces].sort((a, b) => (b.w * b.h) - (a.w * a.h))

  const resultA = packAll(sorted, BOARD_WIDTH, BOARD_HEIGHT)
  const resultB = packAll(sorted, BOARD_HEIGHT, BOARD_WIDTH)

  const best = resultB.boards < resultA.boards
    ? resultB
    : resultA.boards < resultB.boards
      ? resultA
      : resultA.waste <= resultB.waste ? resultA : resultB

  return best.placements
}

function packAll(
  pieces: Piece[],
  boardW: number,
  boardH: number,
): { placements: PlacedPiece[]; boards: number; waste: number } {
  const bins: GuillotineBin[] = []

  for (const piece of pieces) {
    // Skip pieces that can't possibly fit any board
    if ((piece.w + KERF > boardW || piece.h + KERF > boardH) &&
        (piece.h + KERF > boardW || piece.w + KERF > boardH)) {
      console.warn(`Pieza "${piece.ref}" (${piece.w}×${piece.h}) demasiado grande para el tablero`)
      continue
    }

    let placed = false

    // Best-fit across existing boards: pick the board where the piece fits
    // with the smallest BSSF score (tightest fit)
    let bestBin = -1
    let bestBinScore = Infinity
    for (let i = 0; i < bins.length; i++) {
      const bin = bins[i]
      const score = peekScore(bin, piece)
      if (score !== null && score < bestBinScore) {
        bestBinScore = score; bestBin = i
      }
    }

    if (bestBin !== -1) {
      placed = bins[bestBin].place(piece)
    }

    if (!placed) {
      const bin = new GuillotineBin(boardW, boardH)
      if (bin.place(piece)) {
        bins.push(bin)
      }
    }
  }

  // Convert to flat PlacedPiece array
  const placements: PlacedPiece[] = []
  bins.forEach((bin, boardIndex) => {
    for (const p of bin.placed) {
      placements.push({
        ref: p.ref,
        type: p.type,
        id: p.id,
        w: p.w,
        h: p.h,
        x: p.x,
        y: p.y,
        board: boardIndex,
        rotated: p.rotated,
      })
    }
  })

  const totalArea = bins.length * boardW * boardH
  const usedArea  = bins.reduce((s, b) => s + b.usedArea, 0)

  return { placements, boards: bins.length, waste: totalArea - usedArea }
}

/** Peek at what BSSF score a piece would get in a bin without placing it */
function peekScore(bin: GuillotineBin, piece: Piece): number | null {
  let best: number | null = null

  for (const fr of bin.freeRects) {
    const kw = piece.w + KERF, kh = piece.h + KERF
    if (kw <= fr.w && kh <= fr.h) {
      const s = Math.min(fr.w - kw, fr.h - kh)
      if (best === null || s < best) best = s
    }
    const rkw = piece.h + KERF, rkh = piece.w + KERF
    if (rkw <= fr.w && rkh <= fr.h) {
      const s = Math.min(fr.w - rkw, fr.h - rkh)
      if (best === null || s < best) best = s
    }
  }
  return best
}

/** How many boards are needed */
export function boardCount(placements: PlacedPiece[]): number {
  if (!placements.length) return 0
  return Math.max(...placements.map(p => p.board ?? 0)) + 1
}

/** Waste percentage for a single board given its placed pieces */
export function boardWaste(
  boardPieces: PlacedPiece[],
  boardW = BOARD_WIDTH,
  boardH = BOARD_HEIGHT,
): number {
  const used = boardPieces.reduce((s, p) => s + p.w * p.h, 0)
  const total = boardW * boardH
  return Math.round((1 - used / total) * 100)
}
