import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { query } from '../../db/db'

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
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const rows = query<KpiRow>(
    `SELECT k.*, d.filename FROM kpi_datapoints k
     LEFT JOIN documents d ON d.id = k.document_id
     WHERE k.institution_id = ?
     ORDER BY k.kpi_category, k.kpi_name`,
    [institutionId]
  )

  const categories = Array.from(new Set(rows.map((r) => r.kpi_category ?? 'Other')))
  const years = Array.from(new Set(rows.map((r) => r.fiscal_year).filter(Boolean))) as string[]

  const filtered = rows.filter((r) => {
    const matchCat = categoryFilter === 'all' || (r.kpi_category ?? 'Other') === categoryFilter
    const matchYear = yearFilter === 'all' || r.fiscal_year === yearFilter
    const matchSearch = !search || r.kpi_name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchYear && matchSearch
  })

  if (rows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 font-medium">No KPI data yet</p>
        <p className="text-slate-400 text-sm mt-1">Upload documents and run AI extraction to populate this tab.</p>
      </div>
    )
  }

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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Search KPI name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input w-auto">
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="input w-auto">
          <option value="all">All Years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
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
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700">{r.kpi_name}</td>
                      <td className="px-4 py-2.5 text-slate-700 text-right font-mono">{formatValue(r.value, r.unit)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.fiscal_year ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs truncate max-w-xs">{r.filename ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </div>
  )
}
