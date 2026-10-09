// JSON export / import of the full graph.

/**
 * Export everything to a plain object suitable for JSON.stringify.
 * @param {IDBDatabase} db
 * @returns {Promise<object>}
 */
export async function exportAll (db) {
  const { getAll } = await import('./idb.js')
  const [positions, moves, repertoires, statistics] = await Promise.all([
    getAll(db, 'positions'),
    getAll(db, 'moves'),
    getAll(db, 'repertoires'),
    getAll(db, 'statistics')
  ])
  return {
    version: 1,
    positions,
    moves,
    repertoires,
    statistics
  }
}

/**
 * Import a previously exported document (upserts).
 * @param {IDBDatabase} db
 * @param {object} data
 * @returns {Promise<void>}
 */
export async function importAll (db, data) {
  if (data.version !== 1) throw new Error('Unsupported export version')
  const { put } = await import('./idb.js')
  for (const p of data.positions || []) await put(db, 'positions', p)
  for (const m of data.moves || []) await put(db, 'moves', m)
  for (const r of data.repertoires || []) await put(db, 'repertoires', r)
  for (const s of data.statistics || []) await put(db, 'statistics', s)
}

/**
 * Export a single repertoire plus all reachable positions and moves.
 * @param {IDBDatabase} db
 * @param {string} repertoireId
 * @returns {Promise<object>}
 */
export async function exportRepertoire (db, repertoireId) {
  const { get, getAll } = await import('./idb.js')
  const rep = await get(db, 'repertoires', repertoireId)
  if (!rep) throw new Error('Repertoire not found')
  const allMoves = await getAll(db, 'moves')
  const moveMap = new Map(allMoves.map(m => [m.id, m]))
  const reachableFens = new Set(rep.citations)
  const reachableMoves = []
  for (const id of rep.edges) {
    const m = moveMap.get(id)
    if (m) {
      reachableMoves.push(m)
      reachableFens.add(m.fromFen)
      reachableFens.add(m.toFen)
    }
  }
  const positions = []
  for (const fen of reachableFens) {
    const p = await get(db, 'positions', fen)
    if (p) positions.push(p)
  }
  const statistics = (await getAll(db, 'statistics')).filter(s => s.repertoireId === repertoireId)
  return {
    version: 1,
    positions,
    moves: reachableMoves,
    repertoires: [rep],
    statistics
  }
}
