import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { query } from '../../db/db'
import { StatCard } from '../../components/StatCard'
import { formatPct } from '../../utils/format'
import { axisTickProps, gridProps, tooltipStyle } from '../../utils/chartConfig'

interface SustainabilityRow {
  id: number
  fiscal_year: string | null
  ghg_emissions_total: number | null
  ghg_scope_1: number | null
  ghg_scope_2: number | null
  ghg_scope_3: number | null
  energy_consumption: number | null
  renewable_energy_pct: number | null
  waste_diversion_rate: number | null
  water_consumption: number | null
  net_zero_target_year: string | null
  sustainability_certifications: string | null
}

function hasAnyValue(rows: SustainabilityRow[], key: keyof SustainabilityRow): boolean {
  return rows.some((r) => r[key] != null)
}

export function SustainabilityTab({ institutionId }: { institutionId: number }) {
  const rows = query<SustainabilityRow>(
    'SELECT * FROM sustainability_metrics WHERE institution_id = ? ORDER BY fiscal_year',
    [institutionId]
  )

  if (rows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 font-medium">No sustainability data yet</p>
        <p className="text-slate-400 text-sm mt-1">Upload a Sustainability Report or Annual Report to populate this tab.</p>
      </div>
    )
  }

  const latest = rows[rows.length - 1]

  let certifications: string[] = []
  try { certifications = JSON.parse(latest.sustainability_certifications ?? '[]') } catch { /* ignore */ }

  const chartData = rows.map((r) => ({
    year: r.fiscal_year ?? 'N/A',
    total: r.ghg_emissions_total,
    scope1: r.ghg_scope_1,
    scope2: r.ghg_scope_2,
    scope3: r.ghg_scope_3,
  }))

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total GHG Emissions"
          value={latest.ghg_emissions_total != null ? `${latest.ghg_emissions_total.toLocaleString()} tCO₂e` : '—'}
          subtitle={latest.fiscal_year ?? undefined}
        />
        <StatCard title="Renewable Energy" value={formatPct(latest.renewable_energy_pct)} />
        <StatCard title="Waste Diversion" value={formatPct(latest.waste_diversion_rate)} />
        <StatCard
          title="Net Zero Target"
          value={latest.net_zero_target_year ?? 'Not Set'}
          valueClassName={latest.net_zero_target_year ? 'text-green-600' : 'text-slate-400'}
        />
      </div>

      {/* GHG Trend */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">GHG Emissions Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" tick={axisTickProps} />
            <YAxis tick={axisTickProps} label={{ value: 'tCO₂e', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#475569' } }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${(v as number).toLocaleString()} tCO₂e`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {hasAnyValue(rows, 'ghg_emissions_total') && (
              <Line type="monotone" dataKey="total" name="Total GHG" stroke="#475569" strokeWidth={2} dot={{ r: 4 }} />
            )}
            {hasAnyValue(rows, 'ghg_scope_1') && (
              <Line type="monotone" dataKey="scope1" name="Scope 1" stroke="#dc2626" strokeDasharray="4 2" strokeWidth={1.5} dot={{ r: 3 }} />
            )}
            {hasAnyValue(rows, 'ghg_scope_2') && (
              <Line type="monotone" dataKey="scope2" name="Scope 2" stroke="#ea580c" strokeDasharray="4 2" strokeWidth={1.5} dot={{ r: 3 }} />
            )}
            {hasAnyValue(rows, 'ghg_scope_3') && (
              <Line type="monotone" dataKey="scope3" name="Scope 3" stroke="#ca8a04" strokeDasharray="4 2" strokeWidth={1.5} dot={{ r: 3 }} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Certifications */}
      {certifications.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Certifications</h3>
          <div className="flex flex-wrap gap-2">
            {certifications.map((cert) => (
              <span key={cert} className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-medium">
                {cert}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Data table */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">All Data</h3>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Year', 'Total GHG', 'Scope 1', 'Scope 2', 'Scope 3', 'Renewable %', 'Waste Div. %', 'Net Zero Target'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5">{r.fiscal_year ?? '—'}</td>
                  <td className="px-4 py-2.5">{r.ghg_emissions_total?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-2.5">{r.ghg_scope_1?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-2.5">{r.ghg_scope_2?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-2.5">{r.ghg_scope_3?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-2.5">{formatPct(r.renewable_energy_pct)}</td>
                  <td className="px-4 py-2.5">{formatPct(r.waste_diversion_rate)}</td>
                  <td className="px-4 py-2.5">{r.net_zero_target_year ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
