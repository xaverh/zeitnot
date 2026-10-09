// Repertoire: citations of positions + selected edges + comment overrides.
// Pure functions. Positions and Moves live outside.

/**
 * @typedef {Object} Repertoire
 * @property {string} id
 * @property {string} name
 * @property {'w'|'b'} color
 * @property {string} rootFen
 * @property {string[]} citations   // FENs
 * @property {string[]} edges       // move ids
 * @property {Object.<string, Comment[]>} commentOverrides
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @param {string} id
 * @param {string} name
 * @param {'w'|'b'} color
 * @param {string} rootFen
 * @returns {Repertoire}
 */
export function createRepertoire (id, name, color, rootFen) {
  const now = Date.now()
  return {
    id,
    name,
    color,
    rootFen: rootFen, // expected normalized
    citations: [rootFen],
    edges: [],
    commentOverrides: {},
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Add a citation if not present. Pure.
 * @param {Repertoire} rep
 * @param {string} fen
 * @returns {Repertoire}
 */
export function addCitation (rep, fen) {
  if (rep.citations.includes(fen)) return rep
  return {
    ...rep,
    citations: [...rep.citations, fen],
    updatedAt: Date.now()
  }
}

/**
 * Add an edge (and ensure both endpoints are cited). Pure.
 * @param {Repertoire} rep
 * @param {string} moveId
 * @param {string} fromFen
 * @param {string} toFen
 * @returns {Repertoire}
 */
export function addEdge (rep, moveId, fromFen, toFen) {
  let next = addCitation(rep, fromFen)
  next = addCitation(next, toFen)
  if (next.edges.includes(moveId)) return next
  return {
    ...next,
    edges: [...next.edges, moveId],
    updatedAt: Date.now()
  }
}

/**
 * Remove a citation and all edges that touch it.
 * Positions/Moves themselves are not deleted.
 * @param {Repertoire} rep
 * @param {string} fen
 * @param {Object.<string, {fromFen: string, toFen: string}>} moveIndex  // moveId -> {fromFen, toFen}
 * @returns {Repertoire}
 */
export function removeCitation (rep, fen, moveIndex) {
  const citations = rep.citations.filter(f => f !== fen)
  const edges = rep.edges.filter(id => {
    const m = moveIndex[id]
    return m && m.fromFen !== fen && m.toFen !== fen
  })
  // also drop overrides for this fen
  const commentOverrides = { ...rep.commentOverrides }
  delete commentOverrides[fen]
  return {
    ...rep,
    citations,
    edges,
    commentOverrides,
    updatedAt: Date.now()
  }
}

/**
 * @param {Repertoire} rep
 * @param {string} targetId  // fen or moveId
 * @param {Comment[]} comments
 * @returns {Repertoire}
 */
export function setCommentOverrides (rep, targetId, comments) {
  return {
    ...rep,
    commentOverrides: {
      ...rep.commentOverrides,
      [targetId]: comments
    },
    updatedAt: Date.now()
  }
}
