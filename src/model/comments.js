// Comments: shared base + repertoire-specific overrides/additions.
// Merge rule: shared comments, then overrides (replace by id, append new).

/**
 * @typedef {Object} Comment
 * @property {string} id
 * @property {'text'|'arrow'|'marker'|'pgn'} kind
 * @property {string} [text]
 * @property {string} [from]
 * @property {string} [to]
 * @property {string} [color]
 * @property {string} [pgn]
 */

/**
 * Merge shared comments with repertoire overrides.
 * Overrides with the same id replace; new ids are appended.
 * @param {Comment[]} shared
 * @param {Comment[]} overrides
 * @returns {Comment[]}
 */
export function mergeComments (shared = [], overrides = []) {
  const byId = new Map()
  for (const c of shared) {
    byId.set(c.id, c)
  }
  for (const c of overrides) {
    byId.set(c.id, c)
  }
  return Array.from(byId.values())
}

/**
 * Effective comments for a position or move inside a repertoire.
 * @param {string} targetId
 * @param {Comment[]} shared
 * @param {Object.<string, Comment[]>} commentOverrides
 * @returns {Comment[]}
 */
export function effectiveComments (targetId, shared, commentOverrides) {
  const overrides = commentOverrides[targetId] || []
  return mergeComments(shared, overrides)
}
