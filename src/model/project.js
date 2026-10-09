// Tree projection of a repertoire graph.
// Produces a tree with transposition badges that jump to the first occurrence.
// Never walks edges outside the repertoire.

import { effectiveComments } from './comments.js'

/**
 * @typedef {Object} TreeNode
 * @property {string} fen
 * @property {number} depth
 * @property {import('./move.js').Move|null} viaMove
 * @property {TreeNode[]} children
 * @property {boolean} isTransposition
 * @property {TreeNode|null} transpositionTarget
 * @property {import('./comments.js').Comment[]} comments
 * @property {string|null} san
 */

/**
 * Project a repertoire into a tree.
 * @param {import('./repertoire.js').Repertoire} repertoire
 * @param {Map<string, import('./position.js').Position>} positions  // fen -> Position (optional, for comments)
 * @param {Map<string, import('./move.js').Move>} moves             // id -> Move
 * @returns {TreeNode}
 */
export function projectTree (repertoire, positions, moves) {
  const citedFens = new Set(repertoire.citations)
  const citedEdges = new Set(repertoire.edges)

  // outgoing: fen -> Move[]
  const outgoing = new Map()
  for (const moveId of citedEdges) {
    const m = moves.get(moveId)
    if (m && citedFens.has(m.fromFen) && citedFens.has(m.toFen)) {
      if (!outgoing.has(m.fromFen)) outgoing.set(m.fromFen, [])
      outgoing.get(m.fromFen).push(m)
    }
  }

  const firstNodeForFen = new Map()

  function build (fen, viaMove, depth) {
    const sharedComments = positions.get(fen)?.comments || [] // positions may not carry comments; moves do
    // For simplicity, position comments live on Position if present; otherwise empty.
    // Move comments are on the viaMove.
    const node = {
      fen,
      depth,
      viaMove,
      children: [],
      isTransposition: false,
      transpositionTarget: null,
      comments: effectiveComments(fen, sharedComments, repertoire.commentOverrides),
      san: viaMove ? viaMove.san : null
    }

    if (firstNodeForFen.has(fen)) {
      node.isTransposition = true
      node.transpositionTarget = firstNodeForFen.get(fen)
      return node
    }

    firstNodeForFen.set(fen, node)

    const outs = outgoing.get(fen) || []
    for (const move of outs) {
      const child = build(move.toFen, move, depth + 1)
      node.children.push(child)
    }

    return node
  }

  return build(repertoire.rootFen, null, 0)
}

/**
 * Next moves available from a fen inside the repertoire.
 * @param {string} fen
 * @param {import('./repertoire.js').Repertoire} repertoire
 * @param {Map<string, import('./move.js').Move>} moves
 * @returns {import('./move.js').Move[]}
 */
export function nextMovesInRepertoire (fen, repertoire, moves) {
  const cited = new Set(repertoire.edges)
  const result = []
  for (const id of cited) {
    const m = moves.get(id)
    if (m && m.fromFen === fen) result.push(m)
  }
  return result
}
