import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { SCHEMA_SQL } from './schema'

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
  saveDb()
}

function getDb(): Database {
  if (!db) throw new Error('Database not initialised')
  return db
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
  const data = db.export()
  const b64 = btoa(String.fromCharCode(...Array.from(data as Uint8Array)))
  localStorage.setItem(DB_KEY, b64)
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
