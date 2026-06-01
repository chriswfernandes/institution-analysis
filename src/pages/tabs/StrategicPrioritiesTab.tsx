import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { query } from '../../db/db'
import { StatusBadge } from '../../components/StatusBadge'

interface PlanRow {
  id: number
  plan_name: string | null
  plan_period_start: string | null
  plan_period_end: string | null
  vision_statement: string | null
}

interface PriorityRow {
  id: number
  priority_name: string
  priority_description: string | null
  pillar: string | null
  progress_status: string
  key_initiatives: string | null
}

export function StrategicPrioritiesTab({ institutionId }: { institutionId: number }) {
  const [pillarFilter, setPillarFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [visionExpanded, setVisionExpanded] = useState(false)

  const [plan] = query<PlanRow>(
    'SELECT * FROM strategic_plans WHERE institution_id = ? ORDER BY id DESC LIMIT 1',
    [institutionId]
  )

  const priorities = query<PriorityRow>(
    'SELECT * FROM strategic_priorities WHERE institution_id = ? ORDER BY pillar, id',
    [institutionId]
  )

  const pillars = Array.from(new Set(priorities.map((p) => p.pillar ?? 'Uncategorised')))
  const statuses = Array.from(new Set(priorities.map((p) => p.progress_status)))

  const filtered = priorities.filter((p) => {
    const matchPillar = pillarFilter === 'all' || (p.pillar ?? 'Uncategorised') === pillarFilter
    const matchStatus = statusFilter === 'all' || p.progress_status === statusFilter
    return matchPillar && matchStatus
  })

  if (priorities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 font-medium">No strategic priorities yet</p>
        <p className="text-slate-400 text-sm mt-1">Upload a Strategic Plan document to populate this tab.</p>
      </div>
    )
  }

  // Group by pillar
  const grouped = filtered.reduce<Record<string, PriorityRow[]>>((acc, p) => {
    const key = p.pillar ?? 'Uncategorised'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Plan banner */}
      {plan && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-800">{plan.plan_name ?? 'Strategic Plan'}</p>
              {(plan.plan_period_start || plan.plan_period_end) && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {plan.plan_period_start} – {plan.plan_period_end}
                </p>
              )}
            </div>
            {plan.vision_statement && (
              <button onClick={() => setVisionExpanded((v) => !v)} className="text-xs text-green-600 shrink-0 hover:underline flex items-center gap-0.5">
                Vision {visionExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
          </div>
          {visionExpanded && plan.vision_statement && (
            <p className="mt-2 text-sm text-slate-600 italic border-t border-green-200 pt-2">{plan.vision_statement}</p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={pillarFilter} onChange={(e) => setPillarFilter(e.target.value)} className="input w-auto">
          <option value="all">All Pillars</option>
          {pillars.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="all">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No priorities match the selected filters.</p>
      ) : (
        Object.entries(grouped).map(([pillar, items]) => (
          <div key={pillar}>
            <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">{pillar}</h3>
            <div className="space-y-3">
              {items.map((p) => {
                let initiatives: string[] = []
                try { initiatives = JSON.parse(p.key_initiatives ?? '[]') } catch { /* ignore */ }
                return (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-semibold text-slate-800">{p.priority_name}</p>
                      <StatusBadge status={p.progress_status} />
                    </div>
                    {p.priority_description && (
                      <p className="text-sm text-slate-600 mb-3">{p.priority_description}</p>
                    )}
                    {initiatives.length > 0 && (
                      <ul className="space-y-1">
                        {initiatives.map((init, i) => (
                          <li key={i} className="text-xs text-slate-500 flex gap-2">
                            <span className="text-green-500 mt-0.5 shrink-0">•</span>
                            {init}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
