import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { useAppState } from '../context/AppContext'
import { query } from '../db/db'
import { formatCurrency } from '../utils/format'
import { PALETTE, axisTickProps, gridProps } from '../utils/chartConfig'
import type { Institution } from '../types'

type MetricCategory = 'Financial' | 'Enrolment' | 'Sustainability'
type FinancialMetric = 'total_revenue' | 'total_expenses' | 'net_surplus_deficit' | 'total_assets'

const FINANCIAL_METRICS: { key: FinancialMetric; label: string }[] = [
  { key: 'total_revenue', label: 'Total Revenue' },
  { key: 'total_expenses', label: 'Total Expenses' },
  { key: 'net_surplus_deficit', label: 'Net Surplus/Deficit' },
  { key: 'total_assets', label: 'Total Assets' },
]

interface FinRow { fiscal_year: string; [key: string]: string | number | null }
interface KpiRow { institution_id: number; kpi_name: string; value: number | null; unit: string | null; fiscal_year: string | null }
interface SustainRow { institution_id: number; fiscal_year: string | null; ghg_emissions_total: number | null }

export function ComparisonView() {
  const navigate = useNavigate()
  const { institutions } = useAppState()
  const [selected, setSelected] = useState<number[]>([])
  const [category, setCategory] = useState<MetricCategory>('Financial')
  const [financialMetric, setFinancialMetric] = useState<FinancialMetric>('total_revenue')

  function toggleInstitution(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    )
  }

  const selectedInstitutions = institutions.filter((i) => selected.includes(i.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/institutions')} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-semibold text-slate-900">Compare Institutions</h1>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Select institutions (2–4)</p>
          <div className="flex flex-wrap gap-2">
            {institutions.map((inst) => {
              const sel = selected.includes(inst.id)
              const colour = PALETTE[selected.indexOf(inst.id)] ?? '#94a3b8'
              return (
                <button
                  key={inst.id}
                  onClick={() => toggleInstitution(inst.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${sel ? 'text-white' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                  style={sel ? { backgroundColor: colour, borderColor: colour } : {}}
                >
                  {inst.short_code}
                </button>
              )
            })}
          </div>
          {selected.length > 0 && selected.length < 2 && (
            <p className="text-xs text-slate-400 mt-2">Select at least one more institution.</p>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          {(['Financial', 'Enrolment', 'Sustainability'] as MetricCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${category === cat ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
        {category === 'Financial' && (
          <div className="flex gap-2 flex-wrap">
            {FINANCIAL_METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setFinancialMetric(m.key)}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${financialMetric === m.key ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length < 2 ? (
        <div className="py-16 text-center">
          <BarChart2 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Select 2–4 institutions above to compare</p>
        </div>
      ) : category === 'Financial' ? (
        <FinancialComparison institutions={selectedInstitutions} metric={financialMetric} />
      ) : category === 'Enrolment' ? (
        <EnrolmentComparison institutions={selectedInstitutions} />
      ) : (
        <SustainabilityComparison institutions={selectedInstitutions} />
      )}
    </div>
  )
}

function FinancialComparison({ institutions, metric }: { institutions: Institution[]; metric: FinancialMetric }) {
  const metricLabel = FINANCIAL_METRICS.find((m) => m.key === metric)?.label ?? metric

  // Get all fiscal years and build chart data
  const allYears = new Set<string>()
  const byInst: Record<number, Record<string, number | null>> = {}

  for (const inst of institutions) {
    const rows = query<{ fiscal_year: string; val: number | null }>(
      `SELECT fiscal_year, ${metric} as val FROM financial_summaries WHERE institution_id = ? ORDER BY fiscal_year`,
      [inst.id]
    )
    byInst[inst.id] = {}
    for (const r of rows) {
      allYears.add(r.fiscal_year)
      byInst[inst.id][r.fiscal_year] = r.val
    }
  }

  const years = Array.from(allYears).sort()
  const chartData = years.map((yr) => {
    const row: FinRow = { fiscal_year: yr }
    for (const inst of institutions) {
      row[inst.short_code] = byInst[inst.id]?.[yr] ?? null
    }
    return row
  })

  if (years.length === 0) {
    return <p className="text-center text-sm text-slate-400 py-8">No financial data for selected institutions.</p>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">{metricLabel} — Year over Year</h3>
        <ResponsiveContainer width="100%" height={280} aria-label={`${metricLabel} comparison bar chart`}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="fiscal_year" tick={axisTickProps} />
            <YAxis tick={axisTickProps} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} />
            <Tooltip formatter={(v) => formatCurrency(v as number)} />
            <Legend />
            {institutions.map((inst, idx) => (
              <Bar key={inst.id} dataKey={inst.short_code} fill={PALETTE[idx % PALETTE.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Fiscal Year</th>
              {institutions.map((inst) => (
                <th key={inst.id} className="text-right px-4 py-2.5 font-medium text-slate-600">{inst.short_code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.fiscal_year} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-700 font-medium">{row.fiscal_year}</td>
                {institutions.map((inst) => (
                  <td key={inst.id} className="px-4 py-2 text-right text-slate-600">
                    {row[inst.short_code] != null ? formatCurrency(row[inst.short_code] as number) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EnrolmentComparison({ institutions }: { institutions: Institution[] }) {
  // Find shared KPI names in the Enrolment category
  const kpiMap: Record<string, Record<number, number | null>> = {}

  for (const inst of institutions) {
    const rows = query<KpiRow>(
      `SELECT institution_id, kpi_name, value, unit, fiscal_year FROM kpi_datapoints
       WHERE institution_id = ? AND kpi_category = 'Enrolment'`,
      [inst.id]
    )
    for (const r of rows) {
      if (!kpiMap[r.kpi_name]) kpiMap[r.kpi_name] = {}
      kpiMap[r.kpi_name][inst.id] = r.value
    }
  }

  const kpiNames = Object.keys(kpiMap)

  if (kpiNames.length === 0) {
    return <p className="text-center text-sm text-slate-400 py-8">No Enrolment KPI data for selected institutions.</p>
  }

  const chartData = kpiNames.map((name) => {
    const row: FinRow = { fiscal_year: name }
    for (const inst of institutions) {
      row[inst.short_code] = kpiMap[name][inst.id] ?? null
    }
    return row
  })

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Enrolment KPIs Comparison</h3>
        <ResponsiveContainer width="100%" height={280} aria-label="Enrolment KPI comparison bar chart">
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 40 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="fiscal_year" tick={{ ...axisTickProps, angle: -20, textAnchor: 'end' }} interval={0} />
            <YAxis tick={axisTickProps} />
            <Tooltip />
            <Legend />
            {institutions.map((inst, idx) => (
              <Bar key={inst.id} dataKey={inst.short_code} fill={PALETTE[idx % PALETTE.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">KPI</th>
              {institutions.map((inst) => (
                <th key={inst.id} className="text-right px-4 py-2.5 font-medium text-slate-600">{inst.short_code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.fiscal_year} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-700">{row.fiscal_year}</td>
                {institutions.map((inst) => (
                  <td key={inst.id} className="px-4 py-2 text-right text-slate-600">
                    {row[inst.short_code] != null ? (row[inst.short_code] as number).toLocaleString() : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SustainabilityComparison({ institutions }: { institutions: Institution[] }) {
  const allYears = new Set<string>()
  const byInst: Record<number, Record<string, number | null>> = {}

  for (const inst of institutions) {
    const rows = query<SustainRow>(
      `SELECT institution_id, fiscal_year, ghg_emissions_total FROM sustainability_metrics WHERE institution_id = ? ORDER BY fiscal_year`,
      [inst.id]
    )
    byInst[inst.id] = {}
    for (const r of rows) {
      if (r.fiscal_year) {
        allYears.add(r.fiscal_year)
        byInst[inst.id][r.fiscal_year] = r.ghg_emissions_total
      }
    }
  }

  const years = Array.from(allYears).sort()
  const chartData = years.map((yr) => {
    const row: FinRow = { fiscal_year: yr }
    for (const inst of institutions) {
      row[inst.short_code] = byInst[inst.id]?.[yr] ?? null
    }
    return row
  })

  if (years.length === 0) {
    return <p className="text-center text-sm text-slate-400 py-8">No sustainability data for selected institutions.</p>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">GHG Emissions (tCO2e) — Year over Year</h3>
        <ResponsiveContainer width="100%" height={280} aria-label="GHG emissions comparison line chart">
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="fiscal_year" tick={axisTickProps} />
            <YAxis tick={axisTickProps} />
            <Tooltip />
            <Legend />
            {institutions.map((inst, idx) => (
              <Line key={inst.id} type="monotone" dataKey={inst.short_code} stroke={PALETTE[idx % PALETTE.length]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Fiscal Year</th>
              {institutions.map((inst) => (
                <th key={inst.id} className="text-right px-4 py-2.5 font-medium text-slate-600">{inst.short_code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.fiscal_year} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-700 font-medium">{row.fiscal_year}</td>
                {institutions.map((inst) => (
                  <td key={inst.id} className="px-4 py-2 text-right text-slate-600">
                    {row[inst.short_code] != null ? (row[inst.short_code] as number).toLocaleString() : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
