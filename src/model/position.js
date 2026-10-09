// Position is identified solely by normalized FEN.

/**
 * @typedef {Object} Position
 * @property {string} fen - normalized
 * @property {string} piecePlacement
 * @property {'w'|'b'} turn
 * @property {string} castling
 * @property {string} enPassant
 */

/**
 * Create a Position from a (possibly full) FEN.
 * @param {string} fen
 * @returns {Position}
 */
export function createPosition (fen) {
  const normalized = normalizeFen(fen)
  const parts = normalized.split(' ')
  return {
    fen: normalized,
    piecePlacement: parts[0],
    turn: parts[1],
    castling: parts[2],
    enPassant: parts[3]
  }
}

// re-export for convenience
import { normalizeFen } from './fen.js'
export { normalizeFen }
