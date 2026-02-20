
import { Piece, PlacedPiece } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants';

export const clamp = (v: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, v));

/**
 * Simple shelf-packing algorithm for cut-list optimization.
 * This sorts by height and places pieces in rows.
 */
export function optimizeCutList(pieces: Piece[]): PlacedPiece[] {
  const sorted = [...pieces].sort((a, b) => b.h - a.h);
  const placements: PlacedPiece[] = [];
  
  let currentX = 0;
  let currentY = 0;
  let currentRowHeight = 0;

  for (const piece of sorted) {
    // If piece is wider than board, we can't place it (simple version)
    // Or if it's too wide for remaining row space, start new row
    if (currentX + piece.w > BOARD_WIDTH) {
      currentX = 0;
      currentY += currentRowHeight;
      currentRowHeight = 0;
    }

    // Check if we exceed vertical board space
    if (currentY + piece.h > BOARD_HEIGHT) {
      // In a real optimizer, we'd handle multiple boards here.
      // For this MVP, we just stack them outside or warn.
    }

    placements.push({
      ...piece,
      x: currentX,
      y: currentY
    });

    currentX += piece.w;
    currentRowHeight = Math.max(currentRowHeight, piece.h);
  }

  return placements;
}
