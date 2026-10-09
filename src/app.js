// Main entry. Wires pure model + modes.

import { openDb, put, getAll, get } from './store/idb.js'
import { createRepertoire } from './model/repertoire.js'
import { START_FEN_NORMALIZED } from './model/fen.js'
import { loadMoveMap, getTreeProjection } from './ui/adapter.js'
import { handleBuildMove } from './ui/buildMode.js'
import { pickNextStudyMove, recordStudyAttempt } from './ui/studyMode.js'
import { refreshTree } from './ui/treeRenderer.js'

async function main () {
  const db = await openDb()

  // Ensure a demo repertoire exists
  let reps = await getAll(db, 'repertoires')
  let rep = reps.find(r => r.id === 'demo')
  if (!rep) {
    rep = createRepertoire('demo', 'Demo Repertoire', 'w', START_FEN_NORMALIZED)
    await put(db, 'repertoires', rep)
  }

  const status = document.getElementById('status')
  const treeEl = document.getElementById('tree')
  const setStatus = (msg) => { if (status) status.textContent = msg }

  async function refresh () {
    const moveMap = await loadMoveMap(db)
    const tree = getTreeProjection(rep, moveMap)
    if (treeEl) {
      refreshTree(treeEl, tree, (fen) => setStatus('Jumped to transposition: ' + fen))
    }
    return { moveMap, tree }
  }

  await refresh()
  setStatus('Ready. Build mode adds moves; Study uses SM-2 priority.')

  // Demo Build: add e4 if not present
  document.getElementById('addE4')?.addEventListener('click', async () => {
    try {
      const result = await handleBuildMove(db, rep, START_FEN_NORMALIZED, { from: 'e2', to: 'e4' })
      rep = result.repertoire
      await refresh()
      setStatus('Added e4. Tree updated.')
    } catch (e) {
      setStatus('Build error: ' + e.message)
    }
  })

  // Demo Study: pick highest priority and "review" it
  document.getElementById('studyNext')?.addEventListener('click', async () => {
    const moveMap = await loadMoveMap(db)
    const stats = await getAll(db, 'statistics')
    const statMap = new Map(stats.map(s => [s.id, s]))
    const next = pickNextStudyMove(rep, moveMap, statMap)
    if (!next) {
      setStatus('No moves to study yet. Add some in Build.')
      return
    }
    setStatus(`Studying ${next.move.san} (score ${next.score.toFixed(1)})`)
    // Simulate a correct answer
    await recordStudyAttempt(db, rep.id, next.move.id, true)
    setStatus(`Reviewed ${next.move.san} as correct.`)
  })
}

if (typeof window !== 'undefined') {
  window.onload = () => main().catch(console.error)
}

export { main }
