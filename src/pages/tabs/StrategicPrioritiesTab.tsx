import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2, Download } from 'lucide-react'
import { query } from '../../db/db'
import { upsertStrategicPriority, deleteStrategicPriority } from '../../db/extractionDb'
import { SlideOver } from '../../components/SlideOver'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatusBadge } from '../../components/StatusBadge'
import { useToast } from '../../components/useToast'
import { downloadCsv } from '../../utils/exportCsv'

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

const STATUSES = ['On Track', 'At Risk', 'Achieved', 'Unknown'] as const

type FormState = {
  priority_name: string
  pillar: string
  progress_status: string
  priority_description: string
  key_initiatives: string
}

const EMPTY_FORM: FormState = {
  priority_name: '', pillar: '', progress_status: 'On Track',
  priority_description: '', key_initiatives: '',
}

function rowToForm(r: PriorityRow): FormState {
  let initiatives: string[] = []
  try { initiatives = JSON.parse(r.key_initiatives ?? '[]') } catch { /* ignore */ }
  return {
    priority_name: r.priority_name,
    pillar: r.pillar ?? '',
    progress_status: r.progress_status,
    priority_description: r.priority_description ?? '',
    key_initiatives: initiatives.join('\n'),
  }
}

export function StrategicPrioritiesTab({ institutionId }: { institutionId: number }) {
  const showToast = useToast()
  const [pillarFilter, setPillarFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [visionExpanded, setVisionExpanded] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editRow, setEditRow] = useState<PriorityRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PriorityRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [plan, setPlan] = useState<PlanRow | undefined>(() =>
    query<PlanRow>('SELECT * FROM strategic_plans WHERE institution_id = ? ORDER BY id DESC LIMIT 1', [institutionId])[0]
  )
  const [priorities, setPriorities] = useState<PriorityRow[]>(() =>
    query<PriorityRow>('SELECT * FROM strategic_priorities WHERE institution_id = ? ORDER BY pillar, id', [institutionId])
  )

  function reload() {
    setPlan(query<PlanRow>('SELECT * FROM strategic_plans WHERE institution_id = ? ORDER BY id DESC LIMIT 1', [institutionId])[0])
    setPriorities(query<PriorityRow>('SELECT * FROM strategic_priorities WHERE institution_id = ? ORDER BY pillar, id', [institutionId]))
  }

  useEffect(() => { reload() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const pillars = Array.from(new Set(priorities.map((p) => p.pillar ?? 'Uncategorised')))
  const statuses = Array.from(new Set(priorities.map((p) => p.progress_status)))

  const filtered = priorities.filter((p) => {
    const matchPillar = pillarFilter === 'all' || (p.pillar ?? 'Uncategorised') === pillarFilter
    const matchStatus = statusFilter === 'all' || p.progress_status === statusFilter
    return matchPillar && matchStatus
  })

  const grouped = filtered.reduce<Record<string, PriorityRow[]>>((acc, p) => {
    const key = p.pillar ?? 'Uncategorised'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  function openAdd() {
    setEditRow(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(row: PriorityRow) {
    setEditRow(row)
    setForm(rowToForm(row))
    setFormOpen(true)
  }

  function handleSave() {
    if (!form.priority_name.trim()) {
      showToast('error', 'Priority name is required')
      return
    }
    try {
      upsertStrategicPriority(institutionId, {
        id: editRow?.id,
        priority_name: form.priority_name.trim(),
        pillar: form.pillar.trim() || null,
        progress_status: form.progress_status,
        priority_description: form.priority_description.trim() || null,
        key_initiatives: form.key_initiatives.split('\n').map((s) => s.trim()).filter(Boolean),
      })
      showToast('success', editRow ? 'Priority updated' : 'Priority added')
      setFormOpen(false)
      reload()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteStrategicPriority(deleteTarget.id)
    showToast('success', 'Priority deleted')
    setDeleteTarget(null)
    reload()
  }

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const existingPillars = Array.from(new Set(priorities.map((p) => p.pillar).filter((p): p is string => !!p)))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Strategic Priorities</h3>
        <div className="flex gap-2">
          {priorities.length > 0 && (
            <button
              onClick={() => downloadCsv('strategic-priorities.csv', priorities.map((p) => ({ ...p, key_initiatives: p.key_initiatives ?? '' })))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
            <Plus size={14} /> Add Priority
          </button>
        </div>
      </div>

      {/* Plan banner */}
      {plan && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-800">{plan.plan_name ?? 'Strategic Plan'}</p>
              {(plan.plan_period_start || plan.plan_period_end) && (
                <p className="text-xs text-slate-500 mt-0.5">{plan.plan_period_start} – {plan.plan_period_end}</p>
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

      {priorities.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 font-medium">No strategic priorities yet</p>
          <p className="text-slate-400 text-sm mt-1">Add a priority manually or upload a Strategic Plan document.</p>
        </div>
      ) : (
        <>
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
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={p.progress_status} />
                            <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-slate-700" aria-label="Edit priority"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteTarget(p)} className="text-slate-400 hover:text-red-500" aria-label="Delete priority"><Trash2 size={13} /></button>
                          </div>
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
        </>
      )}

      {/* Form */}
      <SlideOver open={formOpen} onClose={() => setFormOpen(false)} title={editRow ? 'Edit Priority' : 'Add Strategic Priority'}>
        <div className="space-y-4">
          <div>
            <label htmlFor="pri-name" className="block text-sm font-medium text-slate-700 mb-1">Priority Name *</label>
            <input id="pri-name" type="text" value={form.priority_name} onChange={f('priority_name')} className="input" />
          </div>
          <div>
            <label htmlFor="pri-pillar" className="block text-sm font-medium text-slate-700 mb-1">Pillar</label>
            <input id="pri-pillar" type="text" list="pillar-list" value={form.pillar} onChange={f('pillar')} placeholder="e.g. Excellence, Inclusion" className="input" />
            <datalist id="pillar-list">
              {existingPillars.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div>
            <label htmlFor="pri-status" className="block text-sm font-medium text-slate-700 mb-1">Progress Status</label>
            <select id="pri-status" value={form.progress_status} onChange={f('progress_status')} className="input">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pri-desc" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea id="pri-desc" rows={3} value={form.priority_description} onChange={f('priority_description')} className="input resize-none" />
          </div>
          <div>
            <label htmlFor="pri-init" className="block text-sm font-medium text-slate-700 mb-1">Key Initiatives</label>
            <p className="text-xs text-slate-400 mb-1">One initiative per line</p>
            <textarea id="pri-init" rows={4} value={form.key_initiatives} onChange={f('key_initiatives')} className="input resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Save</button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Priority"
        message={`Delete "${deleteTarget?.priority_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
