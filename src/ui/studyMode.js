// Study mode: drill lines that never leave the repertoire.
// Uses SM-2 priority and the tree projection.

import { legalMovesInRepertoire, loadMoveMap, getTreeProjection } from './adapter.js'
import { createStatistic, review, priorityScore } from '../model/statistics.js'
import { put, get } from '../store/idb.js'

/**
 * Pick the highest-priority move from the current position (or any overdue).
 * @param {import('../model/repertoire.js').Repertoire} repertoire
 * @param {Map<string, import('../model/move.js').Move>} moveMap
 * @param {Map<string, import('../model/statistics.js').Statistic>} statMap
 * @returns {{move: import('../model/move.js').Move, score: number}|null}
 */
export function pickNextStudyMove (repertoire, moveMap, statMap) {
  let best = null
  let bestScore = -Infinity
  for (const moveId of repertoire.edges) {
    const move = moveMap.get(moveId)
    if (!move) continue
    const stat = statMap.get(`${repertoire.id}|${moveId}`) || createStatistic(repertoire.id, moveId)
    const score = priorityScore(stat)
    if (score > bestScore) {
      bestScore = score
      best = { move, score, stat }
    }
  }
  return best
}

/**
 * Record a study attempt and return the updated statistic.
 * @param {IDBDatabase} db
 * @param {string} repertoireId
 * @param {string} moveId
 * @param {boolean} correct
 * @param {boolean} [isFinishLine]
 * @returns {Promise<import('../model/statistics.js').Statistic>}
 */
export async function recordStudyAttempt (db, repertoireId, moveId, correct, isFinishLine = false) {
  const id = `${repertoireId}|${moveId}`
  let stat = await get(db, 'statistics', id)
  if (!stat) stat = createStatistic(repertoireId, moveId)
  stat = review(stat, correct, isFinishLine)
  await put(db, 'statistics', stat)
  return stat
}

/**
 * Check whether a played move is the expected one inside the repertoire.
 * @param {string} fen
 * @param {import('../model/repertoire.js').Repertoire} repertoire
 * @param {Map} moveMap
 * @param {{from: string, to: string}} played
 * @returns {import('../model/move.js').Move|null} the matching repertoire move or null
 */
export function matchRepertoireMove (fen, repertoire, moveMap, played) {
  const candidates = legalMovesInRepertoire(fen, repertoire, moveMap)
  return candidates.find(m => m.uci.startsWith(played.from + played.to)) || null
}
