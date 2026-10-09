// Review / Evaluate mode: insights from SM-2 statistics over the repertoire graph.
// Pure functions that summarise priority, weakness, and due moves.

import { priorityScore } from '../model/statistics.js'
import { createStatistic } from '../model/statistics.js'

/**
 * @typedef {Object} ReviewInsight
 * @property {number} totalMoves
 * @property {number} dueCount
 * @property {number} neverReviewed
 * @property {number} averageEase
 * @property {{move: import('../model/move.js').Move, score: number, stat: import('../model/statistics.js').Statistic}[]} weakest
 */

/**
 * Compute review insights for a repertoire.
 * @param {import('../model/repertoire.js').Repertoire} repertoire
 * @param {Map<string, import('../model/move.js').Move>} moveMap
 * @param {Map<string, import('../model/statistics.js').Statistic>} statMap
 * @param {number} [now]
 * @returns {ReviewInsight}
 */
export function computeInsights (repertoire, moveMap, statMap, now = Date.now()) {
  const items = []
  let easeSum = 0
  let easeCount = 0
  let dueCount = 0
  let neverReviewed = 0

  for (const moveId of repertoire.edges) {
    const move = moveMap.get(moveId)
    if (!move) continue
    const stat = statMap.get(`${repertoire.id}|${moveId}`) || createStatistic(repertoire.id, moveId)
    const score = priorityScore(stat, now)
    items.push({ move, score, stat })

    if (stat.totalAttempts === 0) neverReviewed++
    else {
      easeSum += stat.ease
      easeCount++
    }
    if (stat.nextDueAt == null || stat.nextDueAt <= now) dueCount++
  }

  items.sort((a, b) => b.score - a.score)

  return {
    totalMoves: items.length,
    dueCount,
    neverReviewed,
    averageEase: easeCount ? easeSum / easeCount : 2.5,
    weakest: items.slice(0, 5)
  }
}

/**
 * Render insights into a container.
 * @param {HTMLElement} container
 * @param {ReviewInsight} insights
 */
export function renderInsights (container, insights) {
  container.innerHTML = ''
  const lines = [
    `Moves in repertoire: ${insights.totalMoves}`,
    `Due now: ${insights.dueCount}`,
    `Never reviewed: ${insights.neverReviewed}`,
    `Average ease: ${insights.averageEase.toFixed(2)}`,
    '',
    'Highest priority:'
  ]
  for (const w of insights.weakest) {
    lines.push(`  ${w.move.san}  (score ${w.score.toFixed(1)}, wrong ${w.stat.wrong}/${w.stat.totalAttempts})`)
  }
  container.textContent = lines.join('\n')
  container.style.whiteSpace = 'pre'
  container.style.fontFamily = 'ui-monospace, monospace'
  container.style.fontSize = '13px'
}
