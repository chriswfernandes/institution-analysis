export interface Institution {
  id: number
  name: string
  short_code: string
  province: string | null
  institution_type: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
  document_count?: number
}

export interface Tag {
  id: number
  name: string
  colour: string | null
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

export interface DocumentRow {
  id: number
  institution_id: number
  institution_name: string
  filename: string
  document_type: string | null
  fiscal_year: string | null
  upload_date: string
  processing_status: string
  processing_error: string | null
  page_count: number | null
  word_count: number | null
}

export interface ChunkRow {
  id: number
  document_id: number
  chunk_index: number
  chunk_text: string
  token_estimate: number | null
}

export interface ClassificationResult {
  documentType: 'Financial Statement' | 'Strategic Plan' | 'Sustainability Report' | 'Annual Report' | 'Other'
  fiscalYear: string | null
  institutionName: string | null
  confidence: number
}

export interface FinancialExtraction {
  fiscalYear: string | null
  totalRevenue: number | null
  totalExpenses: number | null
  netSurplusDeficit: number | null
  operatingRevenue: number | null
  operatingExpenses: number | null
  governmentGrants: number | null
  tuitionRevenue: number | null
  researchRevenue: number | null
  investmentIncome: number | null
  totalAssets: number | null
  totalLiabilities: number | null
  netAssets: number | null
  endowmentValue: number | null
  internationalStudentRevenue: number | null
  notes: string | null
}

export interface StrategicPriority {
  priorityName: string
  priorityDescription: string | null
  pillar: string | null
  progressStatus: 'On Track' | 'At Risk' | 'Achieved' | 'Unknown'
  keyInitiatives: string[]
}

export interface StrategicExtraction {
  planName: string | null
  planPeriodStart: string | null
  planPeriodEnd: string | null
  visionStatement: string | null
  priorities: StrategicPriority[]
}

export interface SustainabilityExtraction {
  fiscalYear: string | null
  ghgEmissionsTotal: number | null
  ghgScope1: number | null
  ghgScope2: number | null
  ghgScope3: number | null
  emissionsUnit: string | null
  energyConsumption: number | null
  energyUnit: string | null
  renewableEnergyPct: number | null
  wasteDiversionRate: number | null
  waterConsumption: number | null
  netZeroTargetYear: string | null
  sustainabilityCertifications: string[]
  notes: string | null
}

export interface KeyFact {
  kpiName: string
  kpiCategory: string
  value: number | null
  unit: string | null
  fiscalYear: string | null
  notes: string | null
}

export interface KeyFactsExtraction {
  facts: KeyFact[]
}

export interface AnalysisRunRow {
  id: number
  institution_id: number
  run_type: string
  status: string
  started_at: string
  completed_at: string | null
  finding_count?: number
}

export interface FindingRow {
  id: number
  analysis_run_id: number
  institution_id: number
  finding_type: string
  title: string
  narrative: string
  priority_rank: number | null
  relevant_service_line: string | null
}

export interface ParsedFinding {
  finding_type: 'ConsultingOpportunity' | 'Risk' | 'Strength' | 'Trend' | 'Weakness'
  title: string
  narrative: string
  priority_rank: number | null
  relevant_service_line: string | null
}

export interface ProposedTheme {
  themeId: number
  themeName: string
  evidence: string
  relevanceScore: number
}
