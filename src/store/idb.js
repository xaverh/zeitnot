// IndexedDB store for the shared graph + repertoires + statistics.
// Browser-only. Pure-ish wrappers around IDB requests.

const DB_NAME = 'zeitnot'
const DB_VERSION = 1

/**
 * Open the database, creating stores if needed.
 * @returns {Promise<IDBDatabase>}
 */
export function openDb () {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('positions')) {
        db.createObjectStore('positions', { keyPath: 'fen' })
      }
      if (!db.objectStoreNames.contains('moves')) {
        const moves = db.createObjectStore('moves', { keyPath: 'id' })
        moves.createIndex('fromFen', 'fromFen', { unique: false })
        moves.createIndex('toFen', 'toFen', { unique: false })
      }
      if (!db.objectStoreNames.contains('repertoires')) {
        const reps = db.createObjectStore('repertoires', { keyPath: 'id' })
        reps.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains('statistics')) {
        const stats = db.createObjectStore('statistics', { keyPath: 'id' })
        stats.createIndex('repertoireId', 'repertoireId', { unique: false })
        stats.createIndex('moveId', 'moveId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Generic put.
 * @param {IDBDatabase} db
 * @param {string} store
 * @param {object} value
 * @returns {Promise<void>}
 */
export function put (db, store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Generic get.
 * @param {IDBDatabase} db
 * @param {string} store
 * @param {string} key
 * @returns {Promise<object|undefined>}
 */
export function get (db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get all from a store.
 * @param {IDBDatabase} db
 * @param {string} store
 * @returns {Promise<object[]>}
 */
export function getAll (db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Delete by key.
 * @param {IDBDatabase} db
 * @param {string} store
 * @param {string} key
 * @returns {Promise<void>}
 */
export function del (db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
