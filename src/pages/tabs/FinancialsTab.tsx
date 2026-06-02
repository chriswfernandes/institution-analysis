import { useState, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, ResponsiveContainer, Cell,
} from 'recharts'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Download } from 'lucide-react'
import { query } from '../../db/db'
import { upsertFinancialSummary, deleteFinancialSummary } from '../../db/extractionDb'
import { downloadCsv } from '../../utils/exportCsv'
import { SlideOver } from '../../components/SlideOver'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DataTable, type Column } from '../../components/DataTable'
import { useToast } from '../../components/useToast'
import { formatCurrency, deltaPercent } from '../../utils/format'
import { CHART_COLORS, PALETTE, axisTickProps, gridProps, tooltipStyle } from '../../utils/chartConfig'

interface FinancialRow {
  id: number
  institution_id: number
  document_id: number | null
  fiscal_year: string | null
  total_revenue: number | null
  total_expenses: number | null
  net_surplus_deficit: number | null
  operating_revenue: number | null
  operating_expenses: number | null
  government_grants: number | null
  tuition_revenue: number | null
  research_revenue: number | null
  investment_income: number | null
  total_assets: number | null
  total_liabilities: number | null
  net_assets: number | null
  endowment_value: number | null
  international_student_revenue: number | null
  notes: string | null
}

type FormState = {
  fiscal_year: string
  total_revenue: string; total_expenses: string; net_surplus_deficit: string
  operating_revenue: string; operating_expenses: string
  government_grants: string; tuition_revenue: string; research_revenue: string
  investment_income: string; international_student_revenue: string
  total_assets: string; total_liabilities: string; net_assets: string
  endowment_value: string; notes: string
}

const EMPTY_FORM: FormState = {
  fiscal_year: '', total_revenue: '', total_expenses: '', net_surplus_deficit: '',
  operating_revenue: '', operating_expenses: '', government_grants: '',
  tuition_revenue: '', research_revenue: '', investment_income: '',
  international_student_revenue: '', total_assets: '', total_liabilities: '',
  net_assets: '', endowment_value: '', notes: '',
}

function rowToForm(r: FinancialRow): FormState {
  const n = (v: number | null) => (v != null ? String(v) : '')
  return {
    fiscal_year: r.fiscal_year ?? '',
    total_revenue: n(r.total_revenue), total_expenses: n(r.total_expenses),
    net_surplus_deficit: n(r.net_surplus_deficit), operating_revenue: n(r.operating_revenue),
    operating_expenses: n(r.operating_expenses), government_grants: n(r.government_grants),
    tuition_revenue: n(r.tuition_revenue), research_revenue: n(r.research_revenue),
    investment_income: n(r.investment_income),
    international_student_revenue: n(r.international_student_revenue),
    total_assets: n(r.total_assets), total_liabilities: n(r.total_liabilities),
    net_assets: n(r.net_assets), endowment_value: n(r.endowment_value),
    notes: r.notes ?? '',
  }
}

function num(s: string): number | null {
  const v = parseFloat(s)
  return s.trim() === '' || isNaN(v) ? null : v
}

export function FinancialsTab({ institutionId }: { institutionId: number }) {
  const showToast = useToast()
  const [rows, setRows] = useState<FinancialRow[]>(() =>
    query<FinancialRow>('SELECT * FROM financial_summaries WHERE institution_id = ? ORDER BY fiscal_year ASC', [institutionId])
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editRow, setEditRow] = useState<FinancialRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FinancialRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  function reload() {
    setRows(query<FinancialRow>('SELECT * FROM financial_summaries WHERE institution_id = ? ORDER BY fiscal_year ASC', [institutionId]))
  }

  useEffect(() => { reload() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setEditRow(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(row: FinancialRow) {
    setEditRow(row)
    setForm(rowToForm(row))
    setFormOpen(true)
  }

  function handleSave() {
    if (!form.fiscal_year.trim()) {
      showToast('error', 'Fiscal year is required')
      return
    }
    try {
      upsertFinancialSummary(institutionId, {
        id: editRow?.id,
        fiscal_year: form.fiscal_year.trim(),
        total_revenue: num(form.total_revenue),
        total_expenses: num(form.total_expenses),
        net_surplus_deficit: num(form.net_surplus_deficit),
        operating_revenue: num(form.operating_revenue),
        operating_expenses: num(form.operating_expenses),
        government_grants: num(form.government_grants),
        tuition_revenue: num(form.tuition_revenue),
        research_revenue: num(form.research_revenue),
        investment_income: num(form.investment_income),
        international_student_revenue: num(form.international_student_revenue),
        total_assets: num(form.total_assets),
        total_liabilities: num(form.total_liabilities),
        net_assets: num(form.net_assets),
        endowment_value: num(form.endowment_value),
        notes: form.notes.trim() || null,
      })
      showToast('success', editRow ? 'Financial summary updated' : 'Financial summary added')
      setFormOpen(false)
      reload()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteFinancialSummary(deleteTarget.id)
    showToast('success', 'Financial summary deleted')
    setDeleteTarget(null)
    reload()
  }

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const latest = rows.length > 0 ? rows[rows.length - 1] : null

  const revenueSegments = latest ? [
    { name: 'Tuition', value: latest.tuition_revenue },
    { name: 'Gov. Grants', value: latest.government_grants },
    { name: 'Research', value: latest.research_revenue },
    { name: 'Investment', value: latest.investment_income },
    { name: 'International', value: latest.international_student_revenue },
  ].filter((s) => s.value != null && s.value > 0) : []

  if (latest?.total_revenue != null) {
    const knownSum = revenueSegments.reduce((a, s) => a + (s.value ?? 0), 0)
    if (latest.total_revenue - knownSum > 0) revenueSegments.push({ name: 'Other', value: latest.total_revenue - knownSum })
  }

  const yoyColumns: Column<Record<string, unknown>>[] = [
    { key: 'fiscal_year', label: 'Fiscal Year', sortable: true },
    ...(['total_revenue', 'total_expenses', 'net_surplus_deficit', 'total_assets', 'total_liabilities'] as const).map((k) => ({
      key: k,
      label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      render: (value: unknown, row: Record<string, unknown>) => {
        const idx = rows.findIndex((r) => r.fiscal_year === row.fiscal_year)
        const prior = idx > 0 ? rows[idx - 1][k] : null
        const current = value as number | null
        const delta = current != null && prior != null ? deltaPercent(current, prior) : null
        return (
          <div>
            <span>{formatCurrency(current)}</span>
            {delta != null && (
              <span className={`ml-2 text-xs font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {delta >= 0 ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                {' '}{Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
        )
      },
    })),
  ]

  const fullColumns: Column<Record<string, unknown>>[] = [
    { key: 'fiscal_year', label: 'Year', sortable: true },
    { key: 'total_revenue', label: 'Revenue', render: (v) => formatCurrency(v as number | null), sortable: true },
    { key: 'total_expenses', label: 'Expenses', render: (v) => formatCurrency(v as number | null), sortable: true },
    { key: 'net_surplus_deficit', label: 'Surplus/Deficit', render: (v) => formatCurrency(v as number | null), sortable: true },
    { key: 'total_assets', label: 'Assets', render: (v) => formatCurrency(v as number | null), sortable: true },
    { key: 'total_liabilities', label: 'Liabilities', render: (v) => formatCurrency(v as number | null), sortable: true },
    { key: 'net_assets', label: 'Net Assets', render: (v) => formatCurrency(v as number | null), sortable: true },
    { key: 'endowment_value', label: 'Endowment', render: (v) => formatCurrency(v as number | null), sortable: true },
    { key: 'tuition_revenue', label: 'Tuition', render: (v) => formatCurrency(v as number | null) },
    { key: 'government_grants', label: 'Gov. Grants', render: (v) => formatCurrency(v as number | null) },
    {
      key: 'id',
      label: '',
      render: (_v, row) => {
        const r = row as unknown as FinancialRow
        return (
          <div className="flex gap-1 justify-end">
            <button onClick={() => openEdit(r)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Edit row"><Pencil size={13} /></button>
            <button onClick={() => setDeleteTarget(r)} className="p-1 text-slate-400 hover:text-red-500" aria-label="Delete row"><Trash2 size={13} /></button>
          </div>
        )
      },
    },
  ]

  const chartData = rows.map((r) => ({
    year: r.fiscal_year ?? 'N/A',
    revenue: r.total_revenue,
    expenses: r.total_expenses,
    surplus: r.net_surplus_deficit,
  }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Financial Data</h3>
        <div className="flex gap-2">
          {rows.length > 0 && (
            <button
              onClick={() => downloadCsv('financials.csv', rows as unknown as Record<string, unknown>[])}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
            <Plus size={14} /> Add Entry
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 font-medium">No financial data yet</p>
          <p className="text-slate-400 text-sm mt-1">Add an entry manually or upload a Financial Statement to populate this tab.</p>
        </div>
      ) : (
        <>
          {/* Multi-year trend */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Revenue & Expenses Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 40, bottom: 4, left: 10 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="year" tick={axisTickProps} />
                <YAxis yAxisId="left" tick={axisTickProps} tickFormatter={(v: number) => `$${(v / 1e6).toFixed(0)}M`} />
                <YAxis yAxisId="right" orientation="right" tick={axisTickProps} tickFormatter={(v: number) => `$${(v / 1e6).toFixed(0)}M`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v as number)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill={CHART_COLORS.revenue} radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="expenses" name="Expenses" fill={CHART_COLORS.expenses} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="surplus" name="Net Surplus/Deficit" stroke={CHART_COLORS.surplus} strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          {/* Revenue breakdown */}
          {revenueSegments.length > 0 && latest && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Revenue Breakdown — {latest.fiscal_year ?? 'Latest'}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueSegments} layout="vertical" margin={{ left: 10, right: 40 }}>
                  <CartesianGrid {...gridProps} horizontal={false} />
                  <XAxis type="number" tick={axisTickProps} tickFormatter={(v: number) => `$${(v / 1e6).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="name" tick={axisTickProps} width={90} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v as number)} />
                  <Bar dataKey="value" name="Amount" radius={[0, 3, 3, 0]}>
                    {revenueSegments.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* YoY table */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Year-over-Year Changes</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <DataTable columns={yoyColumns} data={rows as unknown as Record<string, unknown>[]} />
            </div>
          </section>

          {/* Full data table */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Full Financial Data</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <DataTable columns={fullColumns} data={rows as unknown as Record<string, unknown>[]} />
            </div>
          </section>
        </>
      )}

      {/* Add / Edit form */}
      <SlideOver open={formOpen} onClose={() => setFormOpen(false)} title={editRow ? 'Edit Financial Summary' : 'Add Financial Summary'}>
        <div className="space-y-4">
          <div>
            <label htmlFor="fin-fy" className="block text-sm font-medium text-slate-700 mb-1">Fiscal Year *</label>
            <input id="fin-fy" type="text" value={form.fiscal_year} onChange={f('fiscal_year')} placeholder="e.g. 2023" className="input" />
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">Revenue</p>
          {([
            ['fin-rev', 'total_revenue', 'Total Revenue'],
            ['fin-oprv', 'operating_revenue', 'Operating Revenue'],
            ['fin-grants', 'government_grants', 'Government Grants'],
            ['fin-tuition', 'tuition_revenue', 'Tuition Revenue'],
            ['fin-research', 'research_revenue', 'Research Revenue'],
            ['fin-invest', 'investment_income', 'Investment Income'],
            ['fin-intl', 'international_student_revenue', 'International Student Revenue'],
          ] as [string, keyof FormState, string][]).map(([id, key, label]) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input id={id} type="number" step="any" value={form[key]} onChange={f(key)} placeholder="CAD" className="input" />
            </div>
          ))}

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">Expenses</p>
          {([
            ['fin-exp', 'total_expenses', 'Total Expenses'],
            ['fin-opex', 'operating_expenses', 'Operating Expenses'],
          ] as [string, keyof FormState, string][]).map(([id, key, label]) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input id={id} type="number" step="any" value={form[key]} onChange={f(key)} placeholder="CAD" className="input" />
            </div>
          ))}

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">Net</p>
          <div>
            <label htmlFor="fin-net" className="block text-sm font-medium text-slate-700 mb-1">Net Surplus / Deficit</label>
            <input id="fin-net" type="number" step="any" value={form.net_surplus_deficit} onChange={f('net_surplus_deficit')} placeholder="Positive = surplus" className="input" />
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">Balance Sheet</p>
          {([
            ['fin-assets', 'total_assets', 'Total Assets'],
            ['fin-liab', 'total_liabilities', 'Total Liabilities'],
            ['fin-netassets', 'net_assets', 'Net Assets'],
            ['fin-endow', 'endowment_value', 'Endowment Value'],
          ] as [string, keyof FormState, string][]).map(([id, key, label]) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input id={id} type="number" step="any" value={form[key]} onChange={f(key)} placeholder="CAD" className="input" />
            </div>
          ))}

          <div>
            <label htmlFor="fin-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea id="fin-notes" rows={2} value={form.notes} onChange={f('notes')} className="input resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Save</button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Financial Summary"
        message={`Delete the ${deleteTarget?.fiscal_year ?? ''} financial summary? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
