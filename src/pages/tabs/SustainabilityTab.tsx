import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Plus, Pencil, Trash2, Download } from 'lucide-react'
import { query } from '../../db/db'
import { upsertSustainabilityMetric, deleteSustainabilityMetric } from '../../db/extractionDb'
import { SlideOver } from '../../components/SlideOver'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatCard } from '../../components/StatCard'
import { useToast } from '../../components/useToast'
import { formatPct } from '../../utils/format'
import { downloadCsv } from '../../utils/exportCsv'
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

type FormState = {
  fiscal_year: string
  ghg_emissions_total: string; ghg_scope_1: string; ghg_scope_2: string; ghg_scope_3: string
  energy_consumption: string; renewable_energy_pct: string
  waste_diversion_rate: string; water_consumption: string
  net_zero_target_year: string; sustainability_certifications: string
}

const EMPTY_FORM: FormState = {
  fiscal_year: '', ghg_emissions_total: '', ghg_scope_1: '', ghg_scope_2: '', ghg_scope_3: '',
  energy_consumption: '', renewable_energy_pct: '', waste_diversion_rate: '', water_consumption: '',
  net_zero_target_year: '', sustainability_certifications: '',
}

function rowToForm(r: SustainabilityRow): FormState {
  const n = (v: number | null) => (v != null ? String(v) : '')
  let certs: string[] = []
  try { certs = JSON.parse(r.sustainability_certifications ?? '[]') } catch { /* ignore */ }
  return {
    fiscal_year: r.fiscal_year ?? '',
    ghg_emissions_total: n(r.ghg_emissions_total), ghg_scope_1: n(r.ghg_scope_1),
    ghg_scope_2: n(r.ghg_scope_2), ghg_scope_3: n(r.ghg_scope_3),
    energy_consumption: n(r.energy_consumption), renewable_energy_pct: n(r.renewable_energy_pct),
    waste_diversion_rate: n(r.waste_diversion_rate), water_consumption: n(r.water_consumption),
    net_zero_target_year: r.net_zero_target_year ?? '',
    sustainability_certifications: certs.join(', '),
  }
}

function num(s: string): number | null {
  const v = parseFloat(s)
  return s.trim() === '' || isNaN(v) ? null : v
}

function hasAnyValue(rows: SustainabilityRow[], key: keyof SustainabilityRow): boolean {
  return rows.some((r) => r[key] != null)
}

export function SustainabilityTab({ institutionId }: { institutionId: number }) {
  const showToast = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editRow, setEditRow] = useState<SustainabilityRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SustainabilityRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [rows, setRows] = useState<SustainabilityRow[]>(() =>
    query<SustainabilityRow>('SELECT * FROM sustainability_metrics WHERE institution_id = ? ORDER BY fiscal_year', [institutionId])
  )

  function reload() {
    setRows(query<SustainabilityRow>('SELECT * FROM sustainability_metrics WHERE institution_id = ? ORDER BY fiscal_year', [institutionId]))
  }

  useEffect(() => { reload() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const latest = rows.length > 0 ? rows[rows.length - 1] : null

  let certifications: string[] = []
  if (latest) {
    try { certifications = JSON.parse(latest.sustainability_certifications ?? '[]') } catch { /* ignore */ }
  }

  const chartData = rows.map((r) => ({
    year: r.fiscal_year ?? 'N/A',
    total: r.ghg_emissions_total,
    scope1: r.ghg_scope_1,
    scope2: r.ghg_scope_2,
    scope3: r.ghg_scope_3,
  }))

  function openAdd() {
    setEditRow(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(row: SustainabilityRow) {
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
      const certs = form.sustainability_certifications
        .split(',').map((s) => s.trim()).filter(Boolean)
      upsertSustainabilityMetric(institutionId, {
        id: editRow?.id,
        fiscal_year: form.fiscal_year.trim(),
        ghg_emissions_total: num(form.ghg_emissions_total),
        ghg_scope_1: num(form.ghg_scope_1),
        ghg_scope_2: num(form.ghg_scope_2),
        ghg_scope_3: num(form.ghg_scope_3),
        energy_consumption: num(form.energy_consumption),
        renewable_energy_pct: num(form.renewable_energy_pct),
        waste_diversion_rate: num(form.waste_diversion_rate),
        water_consumption: num(form.water_consumption),
        net_zero_target_year: form.net_zero_target_year.trim() || null,
        sustainability_certifications: certs,
      })
      showToast('success', editRow ? 'Sustainability data updated' : 'Sustainability data added')
      setFormOpen(false)
      reload()
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Save failed')
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteSustainabilityMetric(deleteTarget.id)
    showToast('success', 'Sustainability record deleted')
    setDeleteTarget(null)
    reload()
  }

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Sustainability Metrics</h3>
        <div className="flex gap-2">
          {rows.length > 0 && (
            <button
              onClick={() => downloadCsv('sustainability.csv', rows as unknown as Record<string, unknown>[])}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
            <Plus size={14} /> Add Year
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 font-medium">No sustainability data yet</p>
          <p className="text-slate-400 text-sm mt-1">Add data manually or upload a Sustainability Report.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          {latest && (
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
          )}

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
                  <span key={cert} className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-xs font-medium">{cert}</span>
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
                    {['Year', 'Total GHG', 'Scope 1', 'Scope 2', 'Scope 3', 'Renewable %', 'Waste Div. %', 'Net Zero Target', ''].map((h, i) => (
                      <th key={i} className="text-left px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{h}</th>
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
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(r)} className="text-slate-400 hover:text-slate-700" aria-label="Edit row"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteTarget(r)} className="text-slate-400 hover:text-red-500" aria-label="Delete row"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Form */}
      <SlideOver open={formOpen} onClose={() => setFormOpen(false)} title={editRow ? 'Edit Sustainability Data' : 'Add Sustainability Data'}>
        <div className="space-y-4">
          <div>
            <label htmlFor="sus-fy" className="block text-sm font-medium text-slate-700 mb-1">Fiscal Year *</label>
            <input id="sus-fy" type="text" value={form.fiscal_year} onChange={f('fiscal_year')} placeholder="e.g. 2023" className="input" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">GHG Emissions (tCO₂e)</p>
          {([
            ['sus-ghg', 'ghg_emissions_total', 'Total GHG Emissions'],
            ['sus-s1', 'ghg_scope_1', 'Scope 1 (Direct)'],
            ['sus-s2', 'ghg_scope_2', 'Scope 2 (Purchased Energy)'],
            ['sus-s3', 'ghg_scope_3', 'Scope 3 (Value Chain)'],
          ] as [string, keyof FormState, string][]).map(([id, key, label]) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input id={id} type="number" step="any" value={form[key]} onChange={f(key)} className="input" />
            </div>
          ))}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">Energy & Other</p>
          {([
            ['sus-energy', 'energy_consumption', 'Energy Consumption (GJ)'],
            ['sus-renew', 'renewable_energy_pct', 'Renewable Energy %'],
            ['sus-waste', 'waste_diversion_rate', 'Waste Diversion Rate %'],
            ['sus-water', 'water_consumption', 'Water Consumption (m³)'],
          ] as [string, keyof FormState, string][]).map(([id, key, label]) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input id={id} type="number" step="any" value={form[key]} onChange={f(key)} className="input" />
            </div>
          ))}
          <div>
            <label htmlFor="sus-nz" className="block text-sm font-medium text-slate-700 mb-1">Net Zero Target Year</label>
            <input id="sus-nz" type="text" value={form.net_zero_target_year} onChange={f('net_zero_target_year')} placeholder="e.g. 2050" className="input" />
          </div>
          <div>
            <label htmlFor="sus-certs" className="block text-sm font-medium text-slate-700 mb-1">Certifications</label>
            <input id="sus-certs" type="text" value={form.sustainability_certifications} onChange={f('sustainability_certifications')} placeholder="e.g. LEED Gold, STARS Silver" className="input" />
            <p className="text-xs text-slate-400 mt-1">Comma-separated</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Save</button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Sustainability Record"
        message={`Delete the ${deleteTarget?.fiscal_year ?? ''} sustainability record? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
