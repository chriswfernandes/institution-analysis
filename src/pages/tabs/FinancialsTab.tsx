import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, ResponsiveContainer, Cell,
} from 'recharts'
import { query } from '../../db/db'
import { DataTable, type Column } from '../../components/DataTable'
import { formatCurrency, deltaPercent } from '../../utils/format'
import { CHART_COLORS, PALETTE, axisTickProps, gridProps, tooltipStyle } from '../../utils/chartConfig'
import { TrendingUp, TrendingDown } from 'lucide-react'

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

export function FinancialsTab({ institutionId }: { institutionId: number }) {
  const rows = query<FinancialRow>(
    'SELECT * FROM financial_summaries WHERE institution_id = ? ORDER BY fiscal_year ASC',
    [institutionId]
  )

  if (rows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 font-medium">No financial data yet</p>
        <p className="text-slate-400 text-sm mt-1">Upload a Financial Statement or Annual Report to populate this tab.</p>
      </div>
    )
  }

  const latest = rows[rows.length - 1]

  // Revenue breakdown data
  const revenueSegments = [
    { name: 'Tuition', value: latest.tuition_revenue },
    { name: 'Gov. Grants', value: latest.government_grants },
    { name: 'Research', value: latest.research_revenue },
    { name: 'Investment', value: latest.investment_income },
    { name: 'International', value: latest.international_student_revenue },
  ].filter((s) => s.value != null && s.value > 0)

  const knownSum = revenueSegments.reduce((a, s) => a + (s.value ?? 0), 0)
  if (latest.total_revenue != null && latest.total_revenue - knownSum > 0) {
    revenueSegments.push({ name: 'Other', value: latest.total_revenue - knownSum })
  }

  // YoY table columns
  const yoyColumns: Column<Record<string, unknown>>[] = [
    { key: 'fiscal_year', label: 'Fiscal Year', sortable: true },
    ...(['total_revenue', 'total_expenses', 'net_surplus_deficit', 'total_assets', 'total_liabilities'] as const).map(
      (k) => ({
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
      })
    ),
  ]

  // Full table columns
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
  ]

  const chartData = rows.map((r) => ({
    year: r.fiscal_year ?? 'N/A',
    revenue: r.total_revenue,
    expenses: r.total_expenses,
    surplus: r.net_surplus_deficit,
  }))

  return (
    <div className="space-y-8">
      {/* Multi-year trend */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Revenue & Expenses Trend</h3>
        {rows.length === 1 && (
          <p className="text-xs text-slate-400 mb-2">Upload more documents to see multi-year trends.</p>
        )}
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
      {revenueSegments.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Revenue Breakdown — {latest.fiscal_year ?? 'Latest'}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueSegments} layout="vertical" margin={{ left: 10, right: 40 }}>
              <CartesianGrid {...gridProps} horizontal={false} />
              <XAxis type="number" tick={axisTickProps} tickFormatter={(v: number) => `$${(v / 1e6).toFixed(0)}M`} />
              <YAxis type="category" dataKey="name" tick={axisTickProps} width={90} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(v as number)} />
              <Bar dataKey="value" name="Amount" radius={[0, 3, 3, 0]}>
                {revenueSegments.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* YoY change table */}
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
    </div>
  )
}
