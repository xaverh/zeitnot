// One-time migration helper: walk an old TreeModel-style repertoire
// (the serialized form from the previous localStorage format) and emit
// Positions, Moves, and a new Repertoire of citations.
// Pure; caller persists the results.

import { normalizeFen } from './model/fen.js'
import { createMove } from './model/move.js'
import { createRepertoire, addEdge } from './model/repertoire.js'

/**
 * Old node shape (simplified from previous serializeRepertoireNode).
 * @typedef {Object} OldNode
 * @property {string} fen
 * @property {string} [lms]          // last move SAN
 * @property {string} [lmf]          // last move from square
 * @property {string} [lmt]          // last move to square
 * @property {OldNode[]} [c]         // children
 */

/**
 * Migrate one old repertoire tree into the new model.
 * @param {string} id
 * @param {string} name
 * @param {'w'|'b'} color
 * @param {OldNode} oldRoot
 * @returns {{repertoire: import('./model/repertoire.js').Repertoire, positions: object[], moves: import('./model/move.js').Move[]}}
 */
export function migrateOldTree (id, name, color, oldRoot) {
  const positions = new Map()
  const moves = new Map()
  let repertoire = createRepertoire(id, name, color, normalizeFen(oldRoot.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'))

  function walk (node, parentFen) {
    const fen = normalizeFen(node.fen)
    if (!positions.has(fen)) {
      positions.set(fen, { fen })
    }
    if (parentFen && node.lmf && node.lmt) {
      try {
        const move = createMove(parentFen, {
          from: node.lmf,
          to: node.lmt,
          promotion: node.lms && node.lms.includes('=') ? node.lms.slice(-1).toLowerCase() : undefined
        })
        if (!moves.has(move.id)) moves.set(move.id, move)
        repertoire = addEdge(repertoire, move.id, move.fromFen, move.toFen)
      } catch (e) {
        // skip illegal / incomplete old nodes
      }
    }
    for (const child of node.c || []) {
      walk(child, fen)
    }
  }

  walk(oldRoot, null)
  return {
    repertoire,
    positions: Array.from(positions.values()),
    moves: Array.from(moves.values())
  }
}
