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
      institutionId, documentId, data.fiscalYear,
      data.totalRevenue, data.totalExpenses, data.netSurplusDeficit,
      data.operatingRevenue, data.operatingExpenses, data.governmentGrants,
      data.tuitionRevenue, data.researchRevenue, data.investmentIncome,
      data.totalAssets, data.totalLiabilities, data.netAssets,
      data.endowmentValue, data.internationalStudentRevenue, data.notes,
    ]
  )
  saveDb()
}

export function saveStrategicPlan(
  institutionId: number,
  documentId: number,
  data: StrategicExtraction
): void {
  execute(
    `INSERT INTO strategic_plans (
      institution_id, document_id, plan_name,
      plan_period_start, plan_period_end, vision_statement
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      institutionId, documentId, data.planName,
      data.planPeriodStart, data.planPeriodEnd, data.visionStatement,
    ]
  )
  const planRows = query<{ id: number }>('SELECT last_insert_rowid() as id')
  const planId = planRows[0].id

  for (const p of data.priorities) {
    execute(
      `INSERT INTO strategic_priorities (
        institution_id, strategic_plan_id, document_id,
        priority_name, priority_description, pillar,
        progress_status, key_initiatives
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        institutionId, planId, documentId,
        p.priorityName, p.priorityDescription, p.pillar,
        p.progressStatus, JSON.stringify(p.keyInitiatives),
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
  execute(
    `INSERT INTO sustainability_metrics (
      institution_id, document_id, fiscal_year,
      ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3,
      energy_consumption, renewable_energy_pct,
      waste_diversion_rate, water_consumption,
      net_zero_target_year, sustainability_certifications
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      institutionId, documentId, data.fiscalYear,
      data.ghgEmissionsTotal, data.ghgScope1, data.ghgScope2, data.ghgScope3,
      data.energyConsumption, data.renewableEnergyPct,
      data.wasteDiversionRate, data.waterConsumption,
      data.netZeroTargetYear, JSON.stringify(data.sustainabilityCertifications),
    ]
  )
  saveDb()
}

export function saveKeyFacts(
  institutionId: number,
  documentId: number,
  facts: KeyFact[]
): void {
  for (const f of facts) {
    execute(
      `INSERT INTO kpi_datapoints (
        institution_id, document_id, kpi_name,
        kpi_category, fiscal_year, value, unit, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        institutionId, documentId, f.kpiName,
        f.kpiCategory, f.fiscalYear, f.value, f.unit, f.notes,
      ]
    )
  }
  saveDb()
}
