import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { SCHEMA_SQL } from './schema'
import { seedDatabase, backfillSeedData } from './seedData'

const DB_KEY = 'he_tracker_db'
let db: Database | null = null

export async function initDb(): Promise<void> {
  const SQL: SqlJsStatic = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  })

  const saved = localStorage.getItem(DB_KEY)
  if (saved) {
    const binary = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0))
    db = new SQL.Database(binary)
  } else {
    db = new SQL.Database()
  }

  db.run(SCHEMA_SQL)
  const isNew = !saved
  if (isNew) {
    try { seedDatabase() } catch { /* non-fatal */ }
  } else {
    try { backfillSeedData() } catch { /* non-fatal */ }
  }
  // Never block boot on persistence. If storage is full, saveDb() throws — but the DB
  // is already loaded in memory, so the app must still open so the user can delete
  // documents (which shrinks the DB and lets the next save succeed) to recover.
  try {
    saveDb()
  } catch (e) {
    console.warn('Initial saveDb failed (storage may be full):', e)
  }
}

function getDb(): Database {
  if (!db) throw new Error('Database not initialised')
  return db
}

// Escape hatch for an unrecoverable / over-quota local database: wipe the persisted
// blob so the next load starts from a fresh, seeded database.
export function clearPersistedDb(): void {
  localStorage.removeItem(DB_KEY)
}

export function query<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = getDb().prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

export function execute(sql: string, params: (string | number | null)[] = []): void {
  getDb().run(sql, params)
}

export function saveDb(): void {
  if (!db) return
  const data = db.export() as Uint8Array
  // Encode in 32KB chunks. Spreading the whole array into String.fromCharCode
  // overflows the call stack once the DB grows (e.g. after ingesting a document).
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < data.length; i += CHUNK) {
    binary += String.fromCharCode(...data.subarray(i, i + CHUNK))
  }
  try {
    localStorage.setItem(DB_KEY, btoa(binary))
  } catch (e) {
    // localStorage is capped (~5 MB/origin). When the DB outgrows it, setItem throws
    // QuotaExceededError. Surfacing a clear message keeps the pipeline from silently
    // leaving a document stuck in "processing" (the in-memory status never persists).
    const isQuota =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    if (isQuota) {
      const mb = (data.length / (1024 * 1024)).toFixed(1)
      throw new Error(
        `Storage limit reached: the local database (${mb} MB) no longer fits in browser storage. ` +
          `Delete some documents (Documents → trash) or export and reset the database in Settings, then try again.`
      )
    }
    throw e
  }
}

export function exportDb(): void {
  if (!db) return
  const data = db.export()
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `he_tracker_${new Date().toISOString().slice(0, 10)}.db`
  a.click()
  URL.revokeObjectURL(url)
  setSetting('last_export_at', new Date().toISOString())
  saveDb()
}

export async function importDb(file: File): Promise<void> {
  const SQL: SqlJsStatic = await initSqlJs({
    locateFile: (f: string) => `/${f}`,
  })
  const buffer = await file.arrayBuffer()
  db = new SQL.Database(new Uint8Array(buffer))
  saveDb()
}

export function getSetting(key: string): string | null {
  const rows = query<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key])
  return rows.length > 0 ? rows[0].value : null
}

export function setSetting(key: string, value: string): void {
  execute('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value])
  saveDb()
}
