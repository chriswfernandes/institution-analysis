import { execute, saveDb, query } from './db'
import type {
  FinancialExtraction,
  StrategicExtraction,
  SustainabilityExtraction,
  KeyFact,
} from '../types'

export function saveFinancials(
  institutionId: number,
  documentId: number,
  data: FinancialExtraction
): void {
  execute('DELETE FROM financial_summaries WHERE document_id = ?', [documentId])
  execute(
    `INSERT INTO financial_summaries (
      institution_id, document_id, fiscal_year,
      total_revenue, total_expenses, net_surplus_deficit,
      operating_revenue, operating_expenses, government_grants,
      tuition_revenue, research_revenue, investment_income,
      total_assets, total_liabilities, net_assets,
      endowment_value, international_student_revenue, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      institutionId, documentId, data.fiscalYear ?? null,
      data.totalRevenue ?? null, data.totalExpenses ?? null, data.netSurplusDeficit ?? null,
      data.operatingRevenue ?? null, data.operatingExpenses ?? null, data.governmentGrants ?? null,
      data.tuitionRevenue ?? null, data.researchRevenue ?? null, data.investmentIncome ?? null,
      data.totalAssets ?? null, data.totalLiabilities ?? null, data.netAssets ?? null,
      data.endowmentValue ?? null, data.internationalStudentRevenue ?? null, data.notes ?? null,
    ]
  )
  saveDb()
}

export function saveStrategicPlan(
  institutionId: number,
  documentId: number,
  data: StrategicExtraction
): void {
  execute('DELETE FROM strategic_priorities WHERE document_id = ?', [documentId])
  execute('DELETE FROM strategic_plans WHERE document_id = ?', [documentId])
  execute(
    `INSERT INTO strategic_plans (
      institution_id, document_id, plan_name,
      plan_period_start, plan_period_end, vision_statement
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      institutionId, documentId, data.planName ?? null,
      data.planPeriodStart ?? null, data.planPeriodEnd ?? null, data.visionStatement ?? null,
    ]
  )
  const planRows = query<{ id: number }>('SELECT last_insert_rowid() as id')
  const planId = planRows[0].id

  for (const p of data.priorities ?? []) {
    execute(
      `INSERT INTO strategic_priorities (
        institution_id, strategic_plan_id, document_id,
        priority_name, priority_description, pillar,
        progress_status, key_initiatives
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        institutionId, planId, documentId,
        p.priorityName ?? null, p.priorityDescription ?? null, p.pillar ?? null,
        p.progressStatus ?? null, JSON.stringify(p.keyInitiatives ?? []),
      ]
    )
  }
  saveDb()
}

export function saveSustainability(
  institutionId: number,
  documentId: number,
  data: SustainabilityExtraction
): void {
  execute('DELETE FROM sustainability_metrics WHERE document_id = ?', [documentId])
  execute(
    `INSERT INTO sustainability_metrics (
      institution_id, document_id, fiscal_year,
      ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
      energy_consumption, renewable_energy_pct,
      waste_diversion_rate, water_consumption,
      net_zero_target_year, sustainability_certifications
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      institutionId, documentId, data.fiscalYear ?? null,
      data.ghgEmissionsTotal ?? null, data.ghgScope1 ?? null, data.ghgScope2 ?? null, data.ghgScope3 ?? null,
      data.energyConsumption ?? null, data.renewableEnergyPct ?? null,
      data.wasteDiversionRate ?? null, data.waterConsumption ?? null,
      data.netZeroTargetYear ?? null, JSON.stringify(data.sustainabilityCertifications ?? []),
    ]
  )
  saveDb()
}

export function saveKeyFacts(
  institutionId: number,
  documentId: number,
  facts: KeyFact[]
): void {
  execute('DELETE FROM kpi_datapoints WHERE document_id = ?', [documentId])
  for (const f of facts) {
    execute(
      `INSERT INTO kpi_datapoints (
        institution_id, document_id, kpi_name,
        kpi_category, fiscal_year, value, unit, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        institutionId, documentId, f.kpiName ?? null,
        f.kpiCategory ?? null, f.fiscalYear ?? null, f.value ?? null, f.unit ?? null, f.notes ?? null,
      ]
    )
  }
  saveDb()
}

export function clearExtractionsForDocument(documentId: number): void {
  execute('DELETE FROM financial_summaries WHERE document_id = ?', [documentId])
  execute('DELETE FROM strategic_priorities WHERE document_id = ?', [documentId])
  execute('DELETE FROM sustainability_metrics WHERE document_id = ?', [documentId])
  execute('DELETE FROM kpi_datapoints WHERE document_id = ?', [documentId])
  saveDb()
}

// ── Manual entry upserts ────────────────────────────────────────────────────

interface FinancialFormData {
  id?: number
  fiscal_year: string
  total_revenue?: number | null
  total_expenses?: number | null
  net_surplus_deficit?: number | null
  operating_revenue?: number | null
  operating_expenses?: number | null
  government_grants?: number | null
  tuition_revenue?: number | null
  research_revenue?: number | null
  investment_income?: number | null
  total_assets?: number | null
  total_liabilities?: number | null
  net_assets?: number | null
  endowment_value?: number | null
  international_student_revenue?: number | null
  notes?: string | null
}

export function upsertFinancialSummary(institutionId: number, data: FinancialFormData): void {
  const cols = [
    'institution_id', 'fiscal_year', 'total_revenue', 'total_expenses',
    'net_surplus_deficit', 'operating_revenue', 'operating_expenses',
    'government_grants', 'tuition_revenue', 'research_revenue',
    'investment_income', 'total_assets', 'total_liabilities',
    'net_assets', 'endowment_value', 'international_student_revenue', 'notes',
  ]
  const vals: (string | number | null)[] = [
    institutionId, data.fiscal_year,
    data.total_revenue ?? null, data.total_expenses ?? null,
    data.net_surplus_deficit ?? null, data.operating_revenue ?? null,
    data.operating_expenses ?? null, data.government_grants ?? null,
    data.tuition_revenue ?? null, data.research_revenue ?? null,
    data.investment_income ?? null, data.total_assets ?? null,
    data.total_liabilities ?? null, data.net_assets ?? null,
    data.endowment_value ?? null, data.international_student_revenue ?? null,
    data.notes ?? null,
  ]
  if (data.id) {
    execute(
      `UPDATE financial_summaries SET ${cols.slice(1).map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...vals.slice(1), data.id]
    )
  } else {
    execute(
      `INSERT INTO financial_summaries (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals
    )
  }
  saveDb()
}

export function deleteFinancialSummary(id: number): void {
  execute('DELETE FROM financial_summaries WHERE id = ?', [id])
  saveDb()
}

interface PriorityFormData {
  id?: number
  priority_name: string
  pillar: string | null
  progress_status: string
  priority_description: string | null
  key_initiatives: string[]
}

export function upsertStrategicPriority(institutionId: number, data: PriorityFormData): void {
  if (data.id) {
    execute(
      `UPDATE strategic_priorities SET priority_name=?, pillar=?, progress_status=?, priority_description=?, key_initiatives=? WHERE id=?`,
      [data.priority_name, data.pillar, data.progress_status, data.priority_description, JSON.stringify(data.key_initiatives), data.id]
    )
  } else {
    // Ensure a manual plan exists
    execute(
      `INSERT OR IGNORE INTO strategic_plans (institution_id, plan_name) VALUES (?, 'Manual')`,
      [institutionId]
    )
    const planRows = query<{ id: number }>(
      `SELECT id FROM strategic_plans WHERE institution_id = ? ORDER BY id ASC LIMIT 1`,
      [institutionId]
    )
    const planId = planRows[0]?.id ?? null
    execute(
      `INSERT INTO strategic_priorities (institution_id, strategic_plan_id, priority_name, pillar, progress_status, priority_description, key_initiatives)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [institutionId, planId, data.priority_name, data.pillar, data.progress_status, data.priority_description, JSON.stringify(data.key_initiatives)]
    )
  }
  saveDb()
}

export function deleteStrategicPriority(id: number): void {
  execute('DELETE FROM strategic_priorities WHERE id = ?', [id])
  saveDb()
}

interface KpiFormData {
  id?: number
  kpi_name: string
  kpi_category: string | null
  value: number | null
  unit: string | null
  fiscal_year: string | null
  notes: string | null
}

export function upsertKpiDatapoint(institutionId: number, data: KpiFormData): void {
  if (data.id) {
    execute(
      `UPDATE kpi_datapoints SET kpi_name=?, kpi_category=?, value=?, unit=?, fiscal_year=?, notes=? WHERE id=?`,
      [data.kpi_name, data.kpi_category, data.value, data.unit, data.fiscal_year, data.notes, data.id]
    )
  } else {
    execute(
      `INSERT INTO kpi_datapoints (institution_id, kpi_name, kpi_category, value, unit, fiscal_year, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [institutionId, data.kpi_name, data.kpi_category, data.value, data.unit, data.fiscal_year, data.notes]
    )
  }
  saveDb()
}

export function deleteKpiDatapoint(id: number): void {
  execute('DELETE FROM kpi_datapoints WHERE id = ?', [id])
  saveDb()
}

interface SustainabilityFormData {
  id?: number
  fiscal_year: string
  ghg_emissions_total?: number | null
  ghg_scope_1?: number | null
  ghg_scope_2?: number | null
  ghg_scope_3?: number | null
  energy_consumption?: number | null
  renewable_energy_pct?: number | null
  waste_diversion_rate?: number | null
  water_consumption?: number | null
  net_zero_target_year?: string | null
  sustainability_certifications?: string[]
}

export function upsertSustainabilityMetric(institutionId: number, data: SustainabilityFormData): void {
  const certs = JSON.stringify(data.sustainability_certifications ?? [])
  if (data.id) {
    execute(
      `UPDATE sustainability_metrics SET fiscal_year=?, ghg_emissions_total=?, ghg_scope_1=?, ghg_scope_2=?, ghg_scope_3=?,
       energy_consumption=?, renewable_energy_pct=?, waste_diversion_rate=?, water_consumption=?,
       net_zero_target_year=?, sustainability_certifications=? WHERE id=?`,
      [data.fiscal_year, data.ghg_emissions_total ?? null, data.ghg_scope_1 ?? null, data.ghg_scope_2 ?? null,
       data.ghg_scope_3 ?? null, data.energy_consumption ?? null, data.renewable_energy_pct ?? null,
       data.waste_diversion_rate ?? null, data.water_consumption ?? null, data.net_zero_target_year ?? null, certs, data.id]
    )
  } else {
    execute(
      `INSERT INTO sustainability_metrics (institution_id, fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
       energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption, net_zero_target_year, sustainability_certifications)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [institutionId, data.fiscal_year, data.ghg_emissions_total ?? null, data.ghg_scope_1 ?? null,
       data.ghg_scope_2 ?? null, data.ghg_scope_3 ?? null, data.energy_consumption ?? null,
       data.renewable_energy_pct ?? null, data.waste_diversion_rate ?? null, data.water_consumption ?? null,
       data.net_zero_target_year ?? null, certs]
    )
  }
  saveDb()
}

export function deleteSustainabilityMetric(id: number): void {
  execute('DELETE FROM sustainability_metrics WHERE id = ?', [id])
  saveDb()
}
