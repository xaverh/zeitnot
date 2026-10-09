// SM-2 spaced repetition for statistics attached to (repertoire, move).
// Pure functions. Based on the classic SuperMemo-2 algorithm.

/**
 * @typedef {Object} Statistic
 * @property {string} id
 * @property {string} repertoireId
 * @property {string} moveId
 * @property {number} right
 * @property {number} wrong
 * @property {number} finishLine
 * @property {number|null} lastReviewedAt
 * @property {number|null} lastWrongAt
 * @property {number} consecutiveCorrect
 * @property {number} ease          // EF, starts at 2.5
 * @property {number} intervalDays
 * @property {number|null} nextDueAt
 * @property {number} recentWrongCount
 * @property {number} totalAttempts
 * @property {number} updatedAt
 */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @param {string} repertoireId
 * @param {string} moveId
 * @returns {Statistic}
 */
export function createStatistic (repertoireId, moveId) {
  return {
    id: `${repertoireId}|${moveId}`,
    repertoireId,
    moveId,
    right: 0,
    wrong: 0,
    finishLine: 0,
    lastReviewedAt: null,
    lastWrongAt: null,
    consecutiveCorrect: 0,
    ease: 2.5,
    intervalDays: 0,
    nextDueAt: null,
    recentWrongCount: 0,
    totalAttempts: 0,
    updatedAt: Date.now()
  }
}

/**
 * SM-2 update after a review.
 * quality: 0-5 (we map wrong=0-2, right=3-5; finishLine can be treated as 5)
 * @param {Statistic} stat
 * @param {boolean} correct
 * @param {boolean} [isFinishLine]
 * @param {number} [now]
 * @returns {Statistic}
 */
export function review (stat, correct, isFinishLine = false, now = Date.now()) {
  const quality = correct ? (isFinishLine ? 5 : 4) : 1

  let { ease, intervalDays, consecutiveCorrect } = stat

  // SM-2 ease update
  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease < 1.3) ease = 1.3

  if (quality < 3) {
    // incorrect
    consecutiveCorrect = 0
    intervalDays = 1
  } else {
    consecutiveCorrect += 1
    if (consecutiveCorrect === 1) {
      intervalDays = 1
    } else if (consecutiveCorrect === 2) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(intervalDays * ease)
    }
  }

  const nextDueAt = now + intervalDays * DAY_MS

  return {
    ...stat,
    right: stat.right + (correct ? 1 : 0),
    wrong: stat.wrong + (correct ? 0 : 1),
    finishLine: stat.finishLine + (isFinishLine ? 1 : 0),
    lastReviewedAt: now,
    lastWrongAt: correct ? stat.lastWrongAt : now,
    consecutiveCorrect,
    ease,
    intervalDays,
    nextDueAt,
    recentWrongCount: correct ? Math.max(0, stat.recentWrongCount - 1) : stat.recentWrongCount + 1,
    totalAttempts: stat.totalAttempts + 1,
    updatedAt: now
  }
}

/**
 * Priority score for study ordering. Higher = more urgent.
 * Overdue first, then weakness.
 * @param {Statistic} stat
 * @param {number} [now]
 * @returns {number}
 */
export function priorityScore (stat, now = Date.now()) {
  const overdue = stat.nextDueAt == null || stat.nextDueAt <= now ? 1000 : 0
  const weakness = stat.totalAttempts === 0
    ? 50
    : (stat.wrong / stat.totalAttempts) * 100
  const recencyBoost = stat.lastWrongAt
    ? Math.max(0, 30 - (now - stat.lastWrongAt) / DAY_MS)
    : 0
  const streakPenalty = stat.consecutiveCorrect * 5
  return overdue + weakness + recencyBoost - streakPenalty
}
