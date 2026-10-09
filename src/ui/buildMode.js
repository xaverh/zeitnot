// Build mode: add moves that stay inside the repertoire.
// Pure-ish orchestration around the adapter.

import { addUserMove, getTreeProjection, loadMoveMap, legalMovesInRepertoire } from './adapter.js'
import { put } from '../store/idb.js'

/**
 * Handle a board move in Build mode.
 * @param {IDBDatabase} db
 * @param {import('../model/repertoire.js').Repertoire} repertoire
 * @param {string} currentFen
 * @param {{from: string, to: string, promotion?: string}} moveSpec
 * @returns {Promise<{repertoire: import('../model/repertoire.js').Repertoire, tree: import('../model/project.js').TreeNode, move: import('../model/move.js').Move}>}
 */
export async function handleBuildMove (db, repertoire, currentFen, moveSpec) {
  const { repertoire: updated, move } = await addUserMove(db, repertoire, currentFen, moveSpec)
  const moveMap = await loadMoveMap(db)
  const tree = getTreeProjection(updated, moveMap)
  return { repertoire: updated, tree, move }
}

/**
 * Get the current legal moves inside the repertoire for the board.
 * @param {string} fen
 * @param {import('../model/repertoire.js').Repertoire} repertoire
 * @param {Map} moveMap
 * @returns {import('../model/move.js').Move[]}
 */
export function getBuildLegalMoves (fen, repertoire, moveMap) {
  return legalMovesInRepertoire(fen, repertoire, moveMap)
}
