import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Star, Lightbulb, AlertTriangle, TrendingUp, CheckCircle, AlertCircle, Clock, Download } from 'lucide-react'
import { getAnalysisRuns, getFindingsByRun } from '../../db/analysisDb'
import type { AnalysisRunRow, FindingRow } from '../../types'
import { downloadCsv } from '../../utils/exportCsv'

interface Props {
  institutionId: number
  refreshKey?: number
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; headerClass: string; badgeClass: string }> = {
  ConsultingOpportunity: {
    label: 'Consulting Opportunity',
    icon: <Lightbulb size={14} />,
    headerClass: 'bg-green-50 border-green-200',
    badgeClass: 'bg-green-100 text-green-800',
  },
  Risk: {
    label: 'Risk',
    icon: <AlertTriangle size={14} />,
    headerClass: 'bg-red-50 border-red-200',
    badgeClass: 'bg-red-100 text-red-800',
  },
  Trend: {
    label: 'Trend',
    icon: <TrendingUp size={14} />,
    headerClass: 'bg-blue-50 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  Strength: {
    label: 'Strength',
    icon: <CheckCircle size={14} />,
    headerClass: 'bg-emerald-50 border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  },
  Weakness: {
    label: 'Weakness',
    icon: <AlertCircle size={14} />,
    headerClass: 'bg-orange-50 border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-800',
  },
}

const SERVICE_LINE_COLOURS: Record<string, string> = {
  'Technology Advisory': 'bg-blue-100 text-blue-700',
  'Financial Advisory': 'bg-green-100 text-green-700',
  'Strategy': 'bg-purple-100 text-purple-700',
  'People & Change': 'bg-orange-100 text-orange-700',
  'Risk Advisory': 'bg-red-100 text-red-700',
}

const TYPE_ORDER = ['ConsultingOpportunity', 'Risk', 'Strength', 'Weakness', 'Trend']

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Complete' ? 'bg-green-100 text-green-700' :
    status === 'Failed' ? 'bg-red-100 text-red-700' :
    'bg-yellow-100 text-yellow-700'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>
}

function PriorityStars({ rank }: { rank: number | null }) {
  if (rank === null) return null
  const stars = Math.max(1, 6 - rank)
  return (
    <span className="flex gap-0.5 text-amber-400" aria-label={`Priority ${rank}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={12} fill={i < stars ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

export function InsightsTab({ institutionId, refreshKey = 0 }: Props) {
  const [runs, setRuns] = useState<AnalysisRunRow[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [findings, setFindings] = useState<FindingRow[]>([])

  useEffect(() => {
    const all = getAnalysisRuns(institutionId)
    setRuns(all)
    if (all.length > 0) {
      const latest = all[0]
      setSelectedRunId(latest.id)
      setFindings(getFindingsByRun(latest.id))
    } else {
      setSelectedRunId(null)
      setFindings([])
    }
  }, [institutionId, refreshKey])

  function selectRun(runId: number) {
    setSelectedRunId(runId)
    setFindings(getFindingsByRun(runId))
  }

  if (runs.length === 0) {
    return (
      <div className="py-16 text-center">
        <Lightbulb size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">No analysis runs yet</p>
        <p className="text-sm text-slate-400 mt-1">Click "Run Full Analysis" in the institution header to generate consulting insights.</p>
      </div>
    )
  }

  const grouped = TYPE_ORDER.reduce<Record<string, FindingRow[]>>((acc, type) => {
    const items = findings.filter((f) => f.finding_type === type)
    if (items.length > 0) acc[type] = items
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Run history */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Analysis Run History</h3>
          {findings.length > 0 && (
            <button
              onClick={() => downloadCsv('insights.csv', findings as unknown as Record<string, unknown>[])}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              <Download size={12} /> Export CSV
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => selectRun(run.id)}
              className={`w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors ${selectedRunId === run.id ? 'bg-slate-50' : ''}`}
            >
              <Clock size={14} className="text-slate-400 shrink-0" />
              <span className="text-sm text-slate-700 flex-1">
                {new Date(run.started_at).toLocaleString()} — {run.run_type}
              </span>
              <StatusBadge status={run.status} />
              {run.finding_count != null && (
                <span className="text-xs text-slate-400">{run.finding_count} findings</span>
              )}
              {selectedRunId === run.id && (
                <span className="text-xs font-medium text-green-600">Viewing</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Findings */}
      {Object.entries(grouped).map(([type, items]) => {
        const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG['Trend']
        return (
          <div key={type}>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 ${cfg.headerClass}`}>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
                {cfg.icon} {cfg.label}s
              </span>
              <span className="text-xs text-slate-500 ml-auto">{items.length} finding{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {items.map((f) => (
                <div key={f.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-slate-800">{f.title}</h4>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityStars rank={f.priority_rank} />
                      {f.relevant_service_line && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SERVICE_LINE_COLOURS[f.relevant_service_line] ?? 'bg-slate-100 text-slate-600'}`}>
                          {f.relevant_service_line}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="prose prose-sm prose-slate max-w-none text-slate-600">
                    <ReactMarkdown>{f.narrative}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {findings.length === 0 && selectedRunId !== null && (
        <p className="text-center text-sm text-slate-400 py-8">No findings for this run.</p>
      )}
    </div>
  )
}
