import type { ExtractItem } from '../../shared/aiTypes.ts'
import type { ReportDocument } from '../types/report.ts'

const DB_NAME = 'clue-workbench'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('extracts')) db.createObjectStore('extracts', { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveReport(report: ReportDocument): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('reports', 'readwrite')
  tx.objectStore('reports').put(report)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadReport(id: string): Promise<ReportDocument | null> {
  const db = await openDb()
  const tx = db.transaction('reports', 'readonly')
  const report = await requestToPromise(tx.objectStore('reports').get(id))
  db.close()
  return (report as ReportDocument | undefined) ?? null
}

export async function listReports(): Promise<ReportDocument[]> {
  const db = await openDb()
  const tx = db.transaction('reports', 'readonly')
  const rows = await requestToPromise(tx.objectStore('reports').getAll())
  db.close()
  return (rows as ReportDocument[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadCachedExtract(key: string): Promise<ExtractItem | null> {
  const db = await openDb()
  const tx = db.transaction('extracts', 'readonly')
  const row = await requestToPromise(tx.objectStore('extracts').get(key))
  db.close()
  const saved = row as { key: string; item: ExtractItem } | undefined
  return saved?.item ?? null
}

export async function saveCachedExtract(key: string, item: ExtractItem): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('extracts', 'readwrite')
  tx.objectStore('extracts').put({ key, item })
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
