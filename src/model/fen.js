// Pure FEN utilities. Position-only FEN keeps piece placement, turn, castling, en passant.
// Halfmove and fullmove clocks are stripped.

import { Chess } from 'chess.js'

/**
 * Normalize a FEN to the position-only form used as identity key.
 * Keeps: piece placement, active color, castling rights, en passant square.
 * Drops: halfmove clock, fullmove number.
 * @param {string} fen
 * @returns {string}
 */
export function normalizeFen (fen) {
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 4) {
    throw new Error('Invalid FEN: ' + fen)
  }
  // piecePlacement turn castling enPassant
  return parts.slice(0, 4).join(' ')
}

/**
 * Validate and normalize using chess.js (ensures legal position if desired).
 * @param {string} fen
 * @returns {string}
 */
export function normalizeFenSafe (fen) {
  const chess = new Chess(fen)
  return normalizeFen(chess.fen())
}

export const START_FEN_NORMALIZED = normalizeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
