import { query } from '../db/db'

interface FinancialRow {
  fiscal_year: string
  total_revenue: number | null
  total_expenses: number | null
  net_surplus_deficit: number | null
  government_grants: number | null
  tuition_revenue: number | null
  research_revenue: number | null
  endowment_value: number | null
}

interface PriorityRow {
  priority_name: string
  pillar: string | null
  progress_status: string | null
  priority_description: string | null
}

interface KpiRow {
  kpi_name: string
  kpi_category: string | null
  value: number | null
  unit: string | null
  fiscal_year: string | null
}

interface SustainRow {
  fiscal_year: string | null
  ghg_emissions_total: number | null
  renewable_energy_pct: number | null
  waste_diversion_rate: number | null
  net_zero_target_year: string | null
}

function fmt(n: number | null, prefix = ''): string {
  if (n === null) return 'N/A'
  return prefix + n.toLocaleString('en-CA', { maximumFractionDigits: 2 })
}

export function compileInstitutionData(institutionId: number): string {
  const financials = query<FinancialRow>(
    `SELECT fiscal_year, total_revenue, total_expenses, net_surplus_deficit,
            government_grants, tuition_revenue, research_revenue, endowment_value
     FROM financial_summaries WHERE institution_id = ? ORDER BY fiscal_year DESC LIMIT 5`,
    [institutionId]
  )

  const priorities = query<PriorityRow>(
    `SELECT priority_name, pillar, progress_status, priority_description
     FROM strategic_priorities WHERE institution_id = ? ORDER BY id ASC`,
    [institutionId]
  )

  const kpis = query<KpiRow>(
    `SELECT kpi_name, kpi_category, value, unit, fiscal_year
     FROM kpi_datapoints WHERE institution_id = ? ORDER BY kpi_category, kpi_name LIMIT 60`,
    [institutionId]
  )

  const sustain = query<SustainRow>(
    `SELECT fiscal_year, ghg_emissions_total, renewable_energy_pct, waste_diversion_rate, net_zero_target_year
     FROM sustainability_metrics WHERE institution_id = ? ORDER BY fiscal_year DESC LIMIT 3`,
    [institutionId]
  )

  const parts: string[] = []

  if (financials.length > 0) {
    parts.push('=== FINANCIAL DATA ===')
    for (const f of financials) {
      parts.push(`FY ${f.fiscal_year}: Revenue=${fmt(f.total_revenue, '$')}  Expenses=${fmt(f.total_expenses, '$')}  Net=${fmt(f.net_surplus_deficit, '$')}  Grants=${fmt(f.government_grants, '$')}  Tuition=${fmt(f.tuition_revenue, '$')}  Research=${fmt(f.research_revenue, '$')}  Endowment=${fmt(f.endowment_value, '$')}`)
    }
  }

  if (priorities.length > 0) {
    parts.push('\n=== STRATEGIC PRIORITIES ===')
    for (const p of priorities) {
      parts.push(`- ${p.priority_name}${p.pillar ? ` [${p.pillar}]` : ''}${p.progress_status ? ` (${p.progress_status})` : ''}${p.priority_description ? ': ' + p.priority_description : ''}`)
    }
  }

  if (kpis.length > 0) {
    parts.push('\n=== KPI DATAPOINTS ===')
    for (const k of kpis) {
      parts.push(`- [${k.kpi_category ?? 'General'}] ${k.kpi_name}: ${fmt(k.value)}${k.unit ? ' ' + k.unit : ''}${k.fiscal_year ? ' (' + k.fiscal_year + ')' : ''}`)
    }
  }

  if (sustain.length > 0) {
    parts.push('\n=== SUSTAINABILITY ===')
    for (const s of sustain) {
      parts.push(`FY ${s.fiscal_year ?? 'N/A'}: GHG=${fmt(s.ghg_emissions_total)} tCO2e  Renewable=${fmt(s.renewable_energy_pct)}%  WasteDiversion=${fmt(s.waste_diversion_rate)}%  NetZeroTarget=${s.net_zero_target_year ?? 'N/A'}`)
    }
  }

  let result = parts.join('\n')
  if (result.length > 8000) {
    // Truncate KPI section first
    const kpiStart = result.indexOf('\n=== KPI DATAPOINTS ===')
    const kpiEnd = result.indexOf('\n=== SUSTAINABILITY ===')
    if (kpiStart !== -1 && kpiEnd !== -1) {
      const kpiSection = result.slice(kpiStart, kpiEnd)
      const kpiLines = kpiSection.split('\n')
      const truncated = kpiLines.slice(0, Math.max(5, Math.floor(kpiLines.length / 2))).join('\n') + '\n[... truncated ...]'
      result = result.slice(0, kpiStart) + truncated + result.slice(kpiEnd)
    }
    if (result.length > 8000) result = result.slice(0, 8000) + '\n[... truncated ...]'
  }

  return result
}
