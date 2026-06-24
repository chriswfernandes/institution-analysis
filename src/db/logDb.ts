import { execute, query, saveDb } from './db'

export type LogLevel = 'info' | 'warn' | 'error'
export type LogCategory = 'llm' | 'docling' | 'pipeline' | 'upload' | 'system'

export interface LogInput {
  level: LogLevel
  category: LogCategory
  message: string
  documentId?: number | null
  documentName?: string | null
  provider?: string | null
  model?: string | null
  purpose?: string | null
  statusCode?: number | null
  durationMs?: number | null
  detail?: string | null
}

export interface LogRow {
  id: number
  ts: string
  level: LogLevel
  category: LogCategory
  message: string
  document_id: number | null
  document_name: string | null
  provider: string | null
  model: string | null
  purpose: string | null
  status_code: number | null
  duration_ms: number | null
  detail: string | null
}

const MAX_ROWS = 500
const DETAIL_MAX = 2000
const FLUSH_DELAY_MS = 1500

// Ambient document context: set by the processing pipeline so LLM calls can be
// attributed to a document without every call site threading it through.
let currentContext: { documentId?: number | null; documentName?: string | null } | null = null

export function setLogContext(ctx: { documentId?: number | null; documentName?: string | null } | null): void {
  currentContext = ctx
}

let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush(immediate: boolean): void {
  if (immediate) {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    saveDb()
    return
  }
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    saveDb()
  }, FLUSH_DELAY_MS)
}

export function addLog(input: LogInput): void {
  const detail = input.detail ? input.detail.slice(0, DETAIL_MAX) : null
  const documentId = input.documentId ?? currentContext?.documentId ?? null
  const documentName = input.documentName ?? currentContext?.documentName ?? null
  try {
    execute(
      `INSERT INTO app_logs
        (level, category, message, document_id, document_name, provider, model, purpose, status_code, duration_ms, detail)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        input.level,
        input.category,
        input.message,
        documentId,
        documentName,
        input.provider ?? null,
        input.model ?? null,
        input.purpose ?? null,
        input.statusCode ?? null,
        input.durationMs ?? null,
        detail,
      ]
    )
    execute(
      `DELETE FROM app_logs WHERE id NOT IN (SELECT id FROM app_logs ORDER BY id DESC LIMIT ?)`,
      [MAX_ROWS]
    )
    scheduleFlush(input.level === 'error')
  } catch {
    // Logging must never throw into the caller's pipeline.
  }
}

export interface LogFilter {
  level?: LogLevel
  category?: LogCategory
  search?: string
  documentId?: number
  limit?: number
}

export function getLogs(filter: LogFilter = {}): LogRow[] {
  const where: string[] = []
  const params: (string | number)[] = []
  if (filter.level) {
    where.push('level = ?')
    params.push(filter.level)
  }
  if (filter.category) {
    where.push('category = ?')
    params.push(filter.category)
  }
  if (filter.documentId != null) {
    where.push('document_id = ?')
    params.push(filter.documentId)
  }
  if (filter.search) {
    where.push('(message LIKE ? OR detail LIKE ?)')
    params.push(`%${filter.search}%`, `%${filter.search}%`)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  params.push(filter.limit ?? MAX_ROWS)
  return query<LogRow>(`SELECT * FROM app_logs ${clause} ORDER BY id DESC LIMIT ?`, params)
}

export function clearLogs(): void {
  execute('DELETE FROM app_logs')
  saveDb()
}
