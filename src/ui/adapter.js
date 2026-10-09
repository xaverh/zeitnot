// Adapter that presents the pure repertoire graph as something the existing
// TreeView / mode code can consume, while staying functional at the core.

import { projectTree, nextMovesInRepertoire } from '../model/project.js'
import { createMove } from '../model/move.js'
import { addEdge, removeCitation } from '../model/repertoire.js'
import { put, getAll } from '../store/idb.js'

/**
 * Load all moves into a Map for projection.
 * @param {IDBDatabase} db
 * @returns {Promise<Map<string, import('../model/move.js').Move>>}
 */
export async function loadMoveMap (db) {
  const all = await getAll(db, 'moves')
  return new Map(all.map(m => [m.id, m]))
}

/**
 * Build the tree projection for a repertoire.
 * @param {import('../model/repertoire.js').Repertoire} repertoire
 * @param {Map<string, import('../model/move.js').Move>} moveMap
 * @returns {import('../model/project.js').TreeNode}
 */
export function getTreeProjection (repertoire, moveMap) {
  return projectTree(repertoire, new Map(), moveMap)
}

/**
 * Attempt to add a user move to the repertoire (Build mode).
 * Stays inside the repertoire; creates Position/Move if needed.
 * @param {IDBDatabase} db
 * @param {import('../model/repertoire.js').Repertoire} repertoire
 * @param {string} fromFen
 * @param {{from: string, to: string, promotion?: string}} moveSpec
 * @returns {Promise<{repertoire: import('../model/repertoire.js').Repertoire, move: import('../model/move.js').Move}>}
 */
export async function addUserMove (db, repertoire, fromFen, moveSpec) {
  const move = createMove(fromFen, moveSpec)
  await put(db, 'positions', { fen: move.fromFen })
  await put(db, 'positions', { fen: move.toFen })
  await put(db, 'moves', move)
  const updated = addEdge(repertoire, move.id, move.fromFen, move.toFen)
  await put(db, 'repertoires', updated)
  return { repertoire: updated, move }
}

/**
 * Moves available from the current position inside the repertoire (Study/Build).
 * @param {string} fen
 * @param {import('../model/repertoire.js').Repertoire} repertoire
 * @param {Map<string, import('../model/move.js').Move>} moveMap
 * @returns {import('../model/move.js').Move[]}
 */
export function legalMovesInRepertoire (fen, repertoire, moveMap) {
  return nextMovesInRepertoire(fen, repertoire, moveMap)
}
