/**
 * Offline analysis queue.
 *
 * When the network is down, a submitted analysis is scored locally by the
 * in-house detector, shown to the user immediately, and stored in IndexedDB.
 * When connectivity returns, each queued item is replayed against the server so
 * the full pipeline (model reasoning, search corroboration, custody record) runs
 * and the provisional result is replaced by the authoritative one.
 *
 * Deliberately visible: the queue is inspectable and drained on demand, because
 * silently replaying an officer's submissions later is worse than making them
 * press a button.
 */

const DB_NAME = 'truthshield-offline'
const DB_VERSION = 1
const STORE = 'queue'

export interface QueuedAnalysis {
  id: string
  kind: 'text' | 'factcheck'
  payload: { text?: string; claim?: string; language?: string }
  /** Provisional score computed on-device at submission time. */
  localVerdict: {
    trustScore: number
    riskLevel: string
    explanation: string
    signals: { id: string; label: string; contribution: number }[]
  }
  createdAt: number
  status: 'queued' | 'syncing' | 'synced' | 'failed'
  syncedReportId?: string
  error?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('status', 'status')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  })
}

export async function enqueue(item: QueuedAnalysis): Promise<void> {
  await tx('readwrite', (s) => s.put(item))
}

export async function listQueue(): Promise<QueuedAnalysis[]> {
  const all = await tx<QueuedAnalysis[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedAnalysis[]>)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function removeFromQueue(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

export async function updateQueued(item: QueuedAnalysis): Promise<void> {
  await tx('readwrite', (s) => s.put(item))
}

export async function pendingCount(): Promise<number> {
  const all = await listQueue()
  return all.filter((i) => i.status === 'queued' || i.status === 'failed').length
}

/**
 * Replay queued items against the server, oldest first.
 * Stops on the first network failure — if the link is down again, hammering the
 * rest of the queue only produces more failures.
 */
export async function drainQueue(
  onProgress?: (item: QueuedAnalysis) => void
): Promise<{ synced: number; failed: number; remaining: number }> {
  const items = (await listQueue())
    .filter((i) => i.status === 'queued' || i.status === 'failed')
    .sort((a, b) => a.createdAt - b.createdAt)

  let synced = 0
  let failed = 0

  for (const item of items) {
    const syncing: QueuedAnalysis = { ...item, status: 'syncing', error: undefined }
    await updateQueued(syncing)
    onProgress?.(syncing)

    try {
      const endpoint = item.kind === 'text' ? '/api/analyze/text' : '/api/factcheck'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `Server returned ${res.status}`)

      const done: QueuedAnalysis = {
        ...item,
        status: 'synced',
        syncedReportId: body?.reportId,
      }
      await updateQueued(done)
      onProgress?.(done)
      synced++
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sync failed'
      const errored: QueuedAnalysis = { ...item, status: 'failed', error: message }
      await updateQueued(errored)
      onProgress?.(errored)
      failed++
      // A transport-level failure means the link is down; stop rather than
      // burning the rest of the queue against a dead connection.
      if (e instanceof TypeError) break
    }
  }

  return { synced, failed, remaining: await pendingCount() }
}

/** Drop items that already synced, so the queue view stays a to-do list. */
export async function clearSynced(): Promise<number> {
  const all = await listQueue()
  const done = all.filter((i) => i.status === 'synced')
  for (const i of done) await removeFromQueue(i.id)
  return done.length
}
