export type ExtractorKey = 'financials' | 'strategic' | 'sustainability' | 'keyFacts'

export interface DocumentTypeConfig {
  label: string
  extractors: ExtractorKey[]
  keyFactsHint: string
  targetTables: string[]
}

export const DOCUMENT_TYPE_REGISTRY: Record<string, DocumentTypeConfig> = {
  'Financial Statement': {
    label: 'Financial Statement',
    extractors: ['financials', 'keyFacts'],
    keyFactsHint: 'Focus on financial ratios, tuition trends, endowment performance, and budget highlights.',
    targetTables: ['financial_summaries', 'kpi_datapoints'],
  },
  'Strategic Plan': {
    label: 'Strategic Plan',
    extractors: ['strategic', 'keyFacts'],
    keyFactsHint: 'Focus on enrolment targets, research goals, staffing plans, and capital project commitments.',
    targetTables: ['strategic_plans', 'strategic_priorities', 'kpi_datapoints'],
  },
  'Sustainability Report': {
    label: 'Sustainability Report',
    extractors: ['sustainability', 'keyFacts'],
    keyFactsHint: 'Focus on emissions targets, energy use, waste diversion, water consumption, and sustainability certifications.',
    targetTables: ['sustainability_metrics', 'kpi_datapoints'],
  },
  'Annual Report': {
    label: 'Annual Report',
    extractors: ['financials', 'strategic', 'sustainability', 'keyFacts'],
    keyFactsHint: 'Focus on enrolment figures, graduation rates, research revenue, international student numbers, and any headline KPIs.',
    targetTables: ['financial_summaries', 'strategic_plans', 'strategic_priorities', 'sustainability_metrics', 'kpi_datapoints'],
  },
  'Enrolment Report': {
    label: 'Enrolment Report',
    extractors: ['keyFacts'],
    keyFactsHint: 'Focus on total enrolment by program, domestic vs international split, indigenous enrolment, graduate vs undergraduate breakdown, and year-on-year trends.',
    targetTables: ['kpi_datapoints'],
  },
  'Budget Submission': {
    label: 'Budget Submission',
    extractors: ['financials', 'keyFacts'],
    keyFactsHint: 'Focus on proposed revenue and expenditure, capital budget items, staffing cost projections, and any noted budget pressures.',
    targetTables: ['financial_summaries', 'kpi_datapoints'],
  },
  'Research Report': {
    label: 'Research Report',
    extractors: ['keyFacts'],
    keyFactsHint: 'Focus on research grants awarded, tri-council funding, industry partnerships, publications, patents, and research centre headcounts.',
    targetTables: ['kpi_datapoints'],
  },
  'Other': {
    label: 'Other',
    extractors: ['keyFacts'],
    keyFactsHint: 'Extract any quantitative facts or strategic statements that are relevant to a higher education consulting engagement.',
    targetTables: ['kpi_datapoints'],
  },
}

export const DOCUMENT_TYPE_LABELS = Object.keys(DOCUMENT_TYPE_REGISTRY)

export function getDocumentTypeConfig(docType: string): DocumentTypeConfig {
  return DOCUMENT_TYPE_REGISTRY[docType] ?? DOCUMENT_TYPE_REGISTRY['Other']
}
