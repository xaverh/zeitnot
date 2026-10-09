// Move / Edge. Identity is (fromFen, toFen, promotion).
// UCI and SAN are cached.

import { Chess } from 'chess.js'
import { normalizeFen } from './fen.js'

/**
 * @typedef {Object} Move
 * @property {string} id
 * @property {string} fromFen
 * @property {string} toFen
 * @property {string} uci
 * @property {string} san
 * @property {'q'|'r'|'b'|'n'|null} promotion
 * @property {Comment[]} comments
 */

/**
 * Deterministic move id.
 * @param {string} fromFen
 * @param {string} toFen
 * @param {string|null} promotion
 * @returns {string}
 */
export function moveId (fromFen, toFen, promotion = null) {
  return `${fromFen}|${toFen}|${promotion ?? ''}`
}

/**
 * Build UCI from squares + promotion.
 * @param {string} from
 * @param {string} to
 * @param {string|null} promotion
 * @returns {string}
 */
export function toUci (from, to, promotion = null) {
  return from + to + (promotion ?? '')
}

/**
 * Create a Move from a from-position and a chess.js move object or UCI-like.
 * Computes SAN and toFen using chess.js.
 * @param {string} fromFen - full or normalized
 * @param {{from: string, to: string, promotion?: string}} moveSpec
 * @returns {Move}
 */
export function createMove (fromFen, moveSpec) {
  const chess = new Chess(fromFen)
  const result = chess.move(moveSpec)
  if (!result) {
    throw new Error('Illegal move: ' + JSON.stringify(moveSpec) + ' from ' + fromFen)
  }
  const toFen = normalizeFen(chess.fen())
  const fromNormalized = normalizeFen(fromFen)
  const promotion = result.promotion || null
  const uci = toUci(result.from, result.to, promotion)
  return {
    id: moveId(fromNormalized, toFen, promotion),
    fromFen: fromNormalized,
    toFen,
    uci,
    san: result.san,
    promotion,
    comments: []
  }
}

/**
 * @param {Move} move
 * @param {Comment} comment
 * @returns {Move}
 */
export function addSharedComment (move, comment) {
  return {
    ...move,
    comments: [...move.comments, comment]
  }
}
