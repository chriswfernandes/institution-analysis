import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Copy, Download, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { useProcessing, type ProcessingStep } from '../context/ProcessingContext'
import { getLogs, clearLogs, type LogRow, type LogLevel, type LogCategory } from '../db/logDb'
import { downloadCsv } from '../utils/exportCsv'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/useToast'

const STEP_LABELS: Record<ProcessingStep, string> = {
  reading: 'Reading…',
  converting: 'Converting with Docling…',
  chunking: 'Chunking…',
  saving: 'Saving…',
  classifying: 'Classifying…',
  awaiting_confirmation: 'Waiting for confirmation…',
  extracting_data: 'Extracting data…',
  writing_db: 'Writing to database…',
  complete: 'Complete',
  failed: 'Failed',
}

const LEVELS: LogLevel[] = ['info', 'warn', 'error']
const CATEGORIES: LogCategory[] = ['llm', 'docling', 'pipeline', 'upload', 'system']
const REFRESH_MS = 3000

const LEVEL_BADGE: Record<LogLevel, string> = {
  info: 'bg-slate-100 text-slate-600',
  warn: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
}

function formatTs(ts: string): string {
  // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' in UTC.
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z')
  return isNaN(d.getTime()) ? ts : d.toLocaleString()
}

function rowToText(r: LogRow): string {
  const parts = [
    `[${formatTs(r.ts)}]`,
    r.level.toUpperCase(),
    r.category,
    r.document_name ? `(${r.document_name})` : '',
    '-',
    r.message,
  ].filter(Boolean)
  const meta = [
    r.provider && `provider=${r.provider}`,
    r.model && `model=${r.model}`,
    r.purpose && `purpose=${r.purpose}`,
    r.status_code != null && `status=${r.status_code}`,
    r.duration_ms != null && `duration=${r.duration_ms}ms`,
  ].filter(Boolean)
  let text = parts.join(' ')
  if (meta.length) text += `\n  ${meta.join('  ')}`
  if (r.detail) text += `\n  ${r.detail}`
  return text
}

export function Admin() {
  const { jobs } = useProcessing()
  const showToast = useToast()

  const [logs, setLogs] = useState<LogRow[]>([])
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = useCallback(() => {
    setLogs(
      getLogs({
        level: levelFilter === 'all' ? undefined : levelFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        search: search.trim() || undefined,
      })
    )
  }, [levelFilter, categoryFilter, search])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const errorCount = useMemo(() => logs.filter((l) => l.level === 'error').length, [logs])

  function copyRow(r: LogRow) {
    navigator.clipboard.writeText(rowToText(r)).then(
      () => showToast('success', 'Log entry copied'),
      () => showToast('error', 'Could not copy to clipboard')
    )
  }

  function copyAll() {
    if (logs.length === 0) {
      showToast('error', 'No logs to copy')
      return
    }
    navigator.clipboard.writeText(logs.map(rowToText).join('\n\n')).then(
      () => showToast('success', `Copied ${logs.length} log entries`),
      () => showToast('error', 'Could not copy to clipboard')
    )
  }

  function exportCsv() {
    if (logs.length === 0) {
      showToast('error', 'No logs to export')
      return
    }
    downloadCsv(
      `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`,
      logs.map((r) => ({
        time: formatTs(r.ts),
        level: r.level,
        category: r.category,
        document: r.document_name ?? '',
        provider: r.provider ?? '',
        model: r.model ?? '',
        purpose: r.purpose ?? '',
        status_code: r.status_code ?? '',
        duration_ms: r.duration_ms ?? '',
        message: r.message,
        detail: r.detail ?? '',
      }))
    )
  }

  function handleClear() {
    clearLogs()
    setConfirmClear(false)
    refresh()
    showToast('success', 'Logs cleared')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
          <p className="text-sm text-slate-500">Activity log and processing status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={copyAll} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50">
            <Copy size={14} /> Copy all
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setConfirmClear(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50">
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Live processing */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Live processing</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-400">No active processing.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center gap-3 text-sm">
                <Loader2 size={14} className="animate-spin text-green-500 shrink-0" />
                <span className="font-medium text-slate-800">{job.fileName}</span>
                <span className="text-slate-500">— {STEP_LABELS[job.step]}</span>
                {job.error && <span className="text-red-600">· {job.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          className="input flex-1 min-w-[200px]"
          placeholder="Search messages and details…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-auto" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'all')}>
          <option value="all">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select className="input w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as LogCategory | 'all')}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-slate-400 mb-2">
        {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        {errorCount > 0 && ` · ${errorCount} error${errorCount === 1 ? '' : 's'}`}
        {' '}(newest first, capped at 500)
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">No logs yet. Process a document to see activity here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="w-8" />
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Time</th>
                <th className="text-left font-medium px-3 py-2">Level</th>
                <th className="text-left font-medium px-3 py-2">Category</th>
                <th className="text-left font-medium px-3 py-2">Document</th>
                <th className="text-left font-medium px-3 py-2">Message</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((r) => {
                const isOpen = expanded === r.id
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="hover:bg-slate-50 cursor-pointer align-top"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <td className="px-2 py-2 text-slate-400">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500 text-xs">{formatTs(r.ts)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${LEVEL_BADGE[r.level]}`}>{r.level}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.category}</td>
                      <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate">{r.document_name ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-800">{r.message}</td>
                      <td className="px-2 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); copyRow(r) }}
                          className="text-slate-400 hover:text-slate-700"
                          aria-label="Copy log entry"
                        >
                          <Copy size={14} />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50">
                        <td />
                        <td colSpan={6} className="px-3 py-3">
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 mb-2">
                            {r.provider && <span><span className="text-slate-400">provider:</span> {r.provider}</span>}
                            {r.model && <span><span className="text-slate-400">model:</span> {r.model}</span>}
                            {r.purpose && <span><span className="text-slate-400">purpose:</span> {r.purpose}</span>}
                            {r.status_code != null && <span><span className="text-slate-400">status:</span> {r.status_code}</span>}
                            {r.duration_ms != null && <span><span className="text-slate-400">duration:</span> {r.duration_ms} ms</span>}
                          </div>
                          {r.detail ? (
                            <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words bg-white border border-slate-200 rounded p-2 max-h-64 overflow-auto">{r.detail}</pre>
                          ) : (
                            <p className="text-xs text-slate-400">No additional detail.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all logs?"
        message="This permanently deletes all activity log entries. This cannot be undone."
        confirmLabel="Clear logs"
        danger
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
