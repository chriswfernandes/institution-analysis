# PRP — Phase 11: Document Type Registry

## Context

The extraction routing in `src/services/processingPipeline.ts` is hardcoded as a series of `if/else` blocks. Adding a new document type (e.g. "Enrolment Report", "Budget Submission") requires editing the pipeline directly and knowing which extractors to wire. There is also a gap: Annual Reports, which are the richest document type, never call `extractKeyFacts()`, so `kpi_datapoints` is never populated from them despite containing enrolment figures, grad rates, and research metrics.

This phase introduces a config-driven **Document Type Registry** that maps each document type to its set of extractors and prompt hints. The pipeline reads from this registry instead of hardcoded logic.

---

## New file: `src/services/documentTypeRegistry.ts`

```ts
export type ExtractorKey =
  | 'financials'
  | 'strategic'
  | 'sustainability'
  | 'keyFacts'

export interface DocumentTypeConfig {
  label: string
  extractors: ExtractorKey[]
  // Focus areas injected into the keyFacts prompt for this document type
  keyFactsHint: string
  // Tables this type populates — shown to the user in ClassificationConfirmModal
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
```

---

## Changes: `src/services/aiService.ts`

`extractKeyFacts()` receives an optional `hint` string that is injected into the prompt:

```ts
export async function extractKeyFacts(
  chunks: ChunkRow[],
  hint = 'Extract any quantitative facts or strategic statements relevant to a higher education consulting engagement.'
): Promise<KeyFactsExtraction>
```

Replace the hardcoded hint sentence in the prompt with the `hint` parameter.

---

## Changes: `src/services/processingPipeline.ts`

Replace the hardcoded `if/else` routing with registry lookups:

```ts
import { getDocumentTypeConfig } from './documentTypeRegistry'
import { extractFinancials, extractStrategicPriorities, extractSustainability, extractKeyFacts } from './aiService'
import { saveFinancials, saveStrategicPlan, saveSustainability, saveKeyFacts } from '../db/extractionDb'

// inside runProcessingPipeline(), after confirmed documentType is known:
const config = getDocumentTypeConfig(confirmed.documentType)

if (config.extractors.includes('financials')) {
  const financials = await extractFinancials(chunks)
  saveFinancials(institutionId, documentId, financials)
}

if (config.extractors.includes('strategic')) {
  const strategic = await extractStrategicPriorities(chunks)
  saveStrategicPlan(institutionId, documentId, strategic)
}

if (config.extractors.includes('sustainability')) {
  const sustainability = await extractSustainability(chunks)
  saveSustainability(institutionId, documentId, sustainability)
}

if (config.extractors.includes('keyFacts')) {
  const keyFacts = await extractKeyFacts(chunks, config.keyFactsHint)
  saveKeyFacts(institutionId, documentId, keyFacts.facts)
}
```

---

## Changes: `src/components/ClassificationConfirmModal.tsx`

Import `getDocumentTypeConfig` and render the **target tables** so the user knows what will be written:

```tsx
import { getDocumentTypeConfig, DOCUMENT_TYPE_LABELS } from '../services/documentTypeRegistry'

// In the modal body, below the document type selector:
const config = getDocumentTypeConfig(selectedType)
<p className="text-xs text-slate-500 mt-2">
  Will populate: {config.targetTables.join(', ')}
</p>
```

Replace the hardcoded `<select>` options for document type with `DOCUMENT_TYPE_LABELS.map(...)` so the dropdown stays in sync with the registry.

---

## Changes: `src/types/index.ts`

Update `ClassificationResult.documentType` from the narrow union type to `string`, so the registry can accept new types without type errors:

```ts
// Before:
documentType: 'Financial Statement' | 'Strategic Plan' | 'Sustainability Report' | 'Annual Report' | 'Other'

// After:
documentType: string
```

---

## Files Modified

| File | Change |
|---|---|
| `src/services/documentTypeRegistry.ts` | New — full registry with 8 document types |
| `src/services/processingPipeline.ts` | Replace if/else with registry lookup |
| `src/services/aiService.ts` | Add `hint` param to `extractKeyFacts()` |
| `src/components/ClassificationConfirmModal.tsx` | Show target tables; sync dropdown with registry |
| `src/types/index.ts` | Widen `documentType` to `string` |

---

## Verification

1. `npm run build` — no TypeScript errors
2. Registry has 8 types — `Object.keys(DOCUMENT_TYPE_REGISTRY).length === 8`
3. `getDocumentTypeConfig('Annual Report').extractors` includes all four keys
4. `getDocumentTypeConfig('Enrolment Report').targetTables` is `['kpi_datapoints']`
5. `ClassificationConfirmModal` dropdown shows all 8 types including "Enrolment Report" and "Budget Submission"
6. Selecting "Annual Report" in the modal shows "Will populate: financial_summaries, strategic_plans, strategic_priorities, sustainability_metrics, kpi_datapoints"
