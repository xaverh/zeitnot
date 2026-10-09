// Main entry. Wires the pure model to a minimal UI shell.
// Full original UI can be progressively adapted to these pure functions.

import { openDb, put, getAll } from './store/idb.js'
import { exportAll } from './store/json.js'
import { createRepertoire, addEdge } from './model/repertoire.js'
import { createMove } from './model/move.js'
import { projectTree } from './model/project.js'
import { createStatistic, review, priorityScore } from './model/statistics.js'
import { START_FEN_NORMALIZED } from './model/fen.js'

async function main () {
  const db = await openDb()

  // Example: create a repertoire and add e4
  let rep = createRepertoire('demo', 'Demo Repertoire', 'w', START_FEN_NORMALIZED)
  const e4 = createMove(START_FEN_NORMALIZED, { from: 'e2', to: 'e4' })
  await put(db, 'positions', { fen: e4.fromFen })
  await put(db, 'positions', { fen: e4.toFen })
  await put(db, 'moves', e4)
  rep = addEdge(rep, e4.id, e4.fromFen, e4.toFen)
  await put(db, 'repertoires', rep)

  // Statistics with SM-2
  let stat = createStatistic(rep.id, e4.id)
  stat = review(stat, false) // wrong
  stat = review(stat, true)  // right
  await put(db, 'statistics', stat)

  // Projection
  const moves = new Map((await getAll(db, 'moves')).map(m => [m.id, m]))
  const positions = new Map()
  const tree = projectTree(rep, positions, moves)
  console.log('Projected tree root children:', tree.children.map(c => c.san))

  // Export
  const exported = await exportAll(db)
  console.log('Export ready, repertoires:', exported.repertoires.length)

  // Priority
  console.log('Priority score for e4:', priorityScore(stat))
}

if (typeof window !== 'undefined') {
  window.onload = () => main().catch(console.error)
}

export { main }
