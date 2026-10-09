import { normalizeFen, START_FEN_NORMALIZED } from '../src/model/fen.js'
import { createPosition } from '../src/model/position.js'
import { createMove, moveId } from '../src/model/move.js'
import { createRepertoire, addEdge, removeCitation } from '../src/model/repertoire.js'
import { projectTree, nextMovesInRepertoire } from '../src/model/project.js'
import { createStatistic, review, priorityScore } from '../src/model/statistics.js'
import { mergeComments } from '../src/model/comments.js'

function assert (cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

// FEN identity
const full = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
assert(normalizeFen(full) === START_FEN_NORMALIZED)
assert(normalizeFen(full) === normalizeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 10'))

// Move identity: promotion distinct
const e4 = createMove(full, { from: 'e2', to: 'e4' })
assert(e4.san === 'e4')
assert(e4.uci === 'e2e4')
assert(e4.promotion === null)

// Repertoire closed
let rep = createRepertoire('r1', 'Test', 'w', START_FEN_NORMALIZED)
rep = addEdge(rep, e4.id, e4.fromFen, e4.toFen)
assert(rep.citations.includes(e4.toFen))
assert(rep.edges.includes(e4.id))

// Projection
const moves = new Map([[e4.id, e4]])
const positions = new Map()
const tree = projectTree(rep, positions, moves)
assert(tree.fen === START_FEN_NORMALIZED)
assert(tree.children.length === 1)
assert(tree.children[0].san === 'e4')
assert(!tree.children[0].isTransposition)

// Remove citation does not require deleting position
const moveIndex = { [e4.id]: { fromFen: e4.fromFen, toFen: e4.toFen } }
const removed = removeCitation(rep, e4.toFen, moveIndex)
assert(!removed.citations.includes(e4.toFen))
assert(!removed.edges.includes(e4.id))

// SM-2
let stat = createStatistic('r1', e4.id)
stat = review(stat, true)
assert(stat.right === 1)
assert(stat.consecutiveCorrect === 1)
assert(stat.ease >= 2.5)
stat = review(stat, false)
assert(stat.wrong === 1)
assert(stat.consecutiveCorrect === 0)
assert(priorityScore(stat) > 0)

// Comments merge
const shared = [{ id: 'c1', kind: 'text', text: 'base' }]
const over = [{ id: 'c1', kind: 'text', text: 'override' }, { id: 'c2', kind: 'text', text: 'add' }]
const merged = mergeComments(shared, over)
assert(merged.length === 2)
assert(merged.find(c => c.id === 'c1').text === 'override')

console.log('All model invariants passed.')
