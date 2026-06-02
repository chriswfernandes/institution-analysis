import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { query } from '../../db/db'
import { upsertKpiDatapoint, deleteKpiDatapoint } from '../../db/extractionDb'
import { SlideOver } from '../../components/SlideOver'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../components/useToast'

interface KpiRow {
  id: number
  kpi_name: string
  kpi_category: string | null
  value: number | null
  unit: string | null
  fiscal_year: string | null
  notes: string | null
  document_id: number | null
  filename: string | null
}

type FormState = {
  kpi_name: string
  kpi_category: string
  value: string
  unit: string
  fiscal_year: string
  notes: string
}

const EMPTY_FORM: FormState = {
  kpi_name: '', kpi_category: '', value: '', unit: '', fiscal_year: '', notes: '',
}

function formatValue(value: number | null, unit: string | null): string {
  if (value == null) return '—'
  const u = unit?.toLowerCase() ?? ''
  if (u === '$' || u === 'cad' || u === 'dollars') {
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
    return `${sign}$${value.toLocaleString()}`
  }
  if (u === '%') return `${value.toFixed(1)}%`
  return unit ? `${value.toLocaleString()} ${unit}` : value.toLocaleString()
}

export function KPIsTab({ institutionId }: { institutionId: number }) {
  const showToast = useToast()
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KpiRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [rows, setRows] = useState<KpiRow[]>(() =>
    query<KpiRow>(
      `SELECT k.*, d.filename FROM kpi_datapoints k LEFT JOIN documents d ON d.id = k.document_id WHERE k.institution_id = ? ORDER BY k.kpi_category, k.kpi_name`,
      [institutionId]
    )
  )

  function reload() {
    setRows(query<KpiRow>(
      `SELECT k.*, d.filename FROM kpi_datapoints k LEFT JOIN documents d ON d.id = k.document_id WHERE k.institution_id = ? ORDER BY k.kpi_category, k.kpi_name`,
      [institutionId]
    ))
  }

  useEffect(() => { reload() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const categories = Array.from(new Set(rows.map((r) => r.kpi_category ?? 'Other')))
  const years = Array.from(new Set(rows.map((r) => r.fiscal_year).filter(Boolean))) as string[]

  const filtered = rows.filter((r) => {
    const matchCat = categoryFilter === 'all' || (r.kpi_category ?? 'Other') === categoryFilter
    const matchYear = yearFilter === 'all' || r.fiscal_year === yearFilter
    const matchSearch = !search || r.kpi_name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchYear && matchSearch
  })

  const grouped = filtered.reduce<Record<string, KpiRow[]>>((acc, r) => {
    const cat = r.kpi_category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
    return acc
  }, {})

  function toggleCollapse(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function handleSave() {
    if (!form.kpi_name.trim()) {
      showToast('error', 'KPI name is required')
      return
    }
    try {
      const v = parseFloat(form.value)
      upsertKpiDatapoint(institutionId, {
        kpi_name: form.kpi_name.trim(),
        kpi_category: form.kpi_category.trim() || null,
        value: form.value.trim() === '' || isNaN(v) ? null : v,
        unit: form.unit.trim() || null,
        fiscal_year: form.fiscal_year.trim() || null,
        notes: form.notes.trim() || null,
      })
      showToast('success', 'KPI added')
      setFormOpen(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteKpiDatapoint(deleteTarget.id)
    showToast('success', 'KPI deleted')
    setDeleteTarget(null)
    reload()
  }

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">KPI Datapoints</h3>
        <button onClick={() => { setForm(EMPTY_FORM); setFormOpen(true) }} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
          <Plus size={14} /> Add KPI
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input type="search" placeholder="Search KPI name…" value={search} onChange={(e) => setSearch(e.target.value)} className="input max-w-xs" aria-label="Search KPIs" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input w-auto" aria-label="Filter by category">
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="input w-auto" aria-label="Filter by year">
          <option value="all">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 font-medium">No KPI data yet</p>
          <p className="text-slate-400 text-sm mt-1">Add a KPI manually or upload documents and run AI extraction.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No KPIs match the selected filters.</p>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCollapse(cat)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
            >
              <span className="flex items-center gap-2">
                {collapsed.has(cat) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="text-sm font-semibold text-slate-700">{cat}</span>
                <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{items.length}</span>
              </span>
            </button>
            {!collapsed.has(cat) && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">KPI Name</th>
                    <th className="text-right px-4 py-2.5 font-medium text-slate-500">Value</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Year</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-500">Source</th>
                    <th className="px-4 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700">{r.kpi_name}</td>
                      <td className="px-4 py-2.5 text-slate-700 text-right font-mono">{formatValue(r.value, r.unit)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.fiscal_year ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs truncate max-w-xs">{r.filename ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setDeleteTarget(r)} className="text-slate-400 hover:text-red-500" aria-label={`Delete ${r.kpi_name}`}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}

      {/* Add form */}
      <SlideOver open={formOpen} onClose={() => setFormOpen(false)} title="Add KPI">
        <div className="space-y-4">
          <div>
            <label htmlFor="kpi-name" className="block text-sm font-medium text-slate-700 mb-1">KPI Name *</label>
            <input id="kpi-name" type="text" value={form.kpi_name} onChange={f('kpi_name')} className="input" />
          </div>
          <div>
            <label htmlFor="kpi-cat" className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <input id="kpi-cat" type="text" list="kpi-cat-list" value={form.kpi_category} onChange={f('kpi_category')} placeholder="e.g. Enrolment, Research, Financial" className="input" />
            <datalist id="kpi-cat-list">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label htmlFor="kpi-value" className="block text-sm font-medium text-slate-700 mb-1">Value</label>
            <input id="kpi-value" type="number" step="any" value={form.value} onChange={f('value')} className="input" />
          </div>
          <div>
            <label htmlFor="kpi-unit" className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
            <input id="kpi-unit" type="text" value={form.unit} onChange={f('unit')} placeholder="e.g. students, %, CAD" className="input" />
          </div>
          <div>
            <label htmlFor="kpi-year" className="block text-sm font-medium text-slate-700 mb-1">Fiscal Year</label>
            <input id="kpi-year" type="text" value={form.fiscal_year} onChange={f('fiscal_year')} placeholder="e.g. 2023" className="input" />
          </div>
          <div>
            <label htmlFor="kpi-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea id="kpi-notes" rows={2} value={form.notes} onChange={f('notes')} className="input resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Save</button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete KPI"
        message={`Delete "${deleteTarget?.kpi_name}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
