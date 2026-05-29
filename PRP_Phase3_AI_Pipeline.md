# PRP — Phase 3: AI Classification & Extraction

## Context

Phases 1 and 2 are complete. The app has institution CRUD, PDF upload, text extraction, chunking, and document list views. Documents are stored with `processing_status = "Pending"`.

This is **Phase 3**. Wire up Azure OpenAI to classify uploaded documents and extract structured data (financials, strategic priorities, sustainability metrics, key facts). After this phase, a consultant can upload a PDF and have structured data automatically written to the database.

---

## AI Service

### File: `src/services/aiService.ts`

#### Azure OpenAI configuration

Read config from `app_settings` table at call time (not cached at module load):
```ts
function getAzureConfig(): { endpoint: string; apiKey: string; deployment: string; apiVersion: string }
```
Throw a descriptive error if any value is missing — let the caller show a toast.

#### Core fetch function

```ts
async function callAzureOpenAI(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { jsonMode?: boolean; temperature?: number; maxTokens?: number }
): Promise<string>
```

Implementation:
- Build URL: `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
- Headers: `{ 'api-key': apiKey, 'Content-Type': 'application/json' }`
- Body: `{ messages, temperature: options?.temperature ?? 0.1, max_tokens: options?.maxTokens ?? 4096 }`
- If `jsonMode`: add `response_format: { type: 'json_object' }` to body
- On HTTP 429: wait 10 seconds, retry up to 3 times
- On non-2xx: throw with `response.statusText`
- Return `data.choices[0].message.content`

#### JSON parse helper

```ts
async function parseJsonWithRetry<T>(
  rawContent: string,
  retryFn: () => Promise<string>
): Promise<T>
```
- Try `JSON.parse(rawContent)` — if it throws, call `retryFn()` (which appends "Return only valid JSON with no preamble." to the prompt), try once more, then throw if still invalid.

#### Exported pipeline functions

```ts
// Test that Azure credentials work
export async function testConnection(): Promise<{ success: boolean; message: string }>

// Step 1: Classify a document using the first 2 chunks
export async function classifyDocument(chunks: ChunkRow[]): Promise<ClassificationResult>

// Step 2a: Extract financial data from chunks
export async function extractFinancials(chunks: ChunkRow[]): Promise<FinancialExtraction>

// Step 2b: Extract strategic priorities from chunks
export async function extractStrategicPriorities(chunks: ChunkRow[]): Promise<StrategicExtraction>

// Step 2c: Extract sustainability metrics from chunks
export async function extractSustainability(chunks: ChunkRow[]): Promise<SustainabilityExtraction>

// Step 2d: Extract generic key facts from chunks
export async function extractKeyFacts(chunks: ChunkRow[]): Promise<KeyFactsExtraction>
```

---

## AI Prompts

Use the exact prompts from the product spec. The **system message** for all calls:

```
You are a higher education sector analyst specializing in Canadian post-secondary institutions. Your role is to extract structured data from institutional documents and identify strategic patterns, financial trends, and intelligence valuable to a management consulting team at Deloitte Canada.

Always output valid JSON only, with no preamble, explanation, or markdown fences. The JSON must be parseable by JSON.parse() with no modifications.
```

### Classification prompt (Prompt 1)

User message:
```
Classify the following document excerpt from a Canadian post-secondary institution.

Return a JSON object with exactly these fields:
{
  "documentType": one of "Financial Statement", "Strategic Plan", "Sustainability Report", "Annual Report", "Other",
  "fiscalYear": "YYYY" or null if not found,
  "institutionName": the full institution name as it appears in the document, or null,
  "confidence": a number between 0 and 1 indicating your confidence in the classification
}

Document text:
---
{CHUNK_0_TEXT}
{CHUNK_1_TEXT}
---
```
Call with `jsonMode: true`. Return type:
```ts
interface ClassificationResult {
  documentType: 'Financial Statement' | 'Strategic Plan' | 'Sustainability Report' | 'Annual Report' | 'Other'
  fiscalYear: string | null
  institutionName: string | null
  confidence: number
}
```

### Financial extraction prompt (Prompt 2A)

Send chunks sequentially — one AI call per chunk. For multi-chunk documents, merge results by taking the first non-null value for each field.

User message (interpolate chunk index/total):
```
Extract financial data from the following text of a Canadian post-secondary institution's financial statement.

Return a JSON object with exactly these fields (use null for any value not found in the text):
{
  "fiscalYear": "YYYY",
  "totalRevenue": number | null,
  "totalExpenses": number | null,
  "netSurplusDeficit": number | null,
  "operatingRevenue": number | null,
  "operatingExpenses": number | null,
  "governmentGrants": number | null,
  "tuitionRevenue": number | null,
  "researchRevenue": number | null,
  "investmentIncome": number | null,
  "totalAssets": number | null,
  "totalLiabilities": number | null,
  "netAssets": number | null,
  "endowmentValue": number | null,
  "internationalStudentRevenue": number | null,
  "notes": "any important caveats or clarifications about the numbers"
}

All monetary values must be in Canadian dollars. If values appear in thousands, convert to full dollars. Do not include commas.

Document text (chunk {CHUNK_INDEX} of {TOTAL_CHUNKS}):
---
{CHUNK_TEXT}
---
```
Call with `jsonMode: true`.

For documents with >8 chunks: process in batches of 3 chunks, merge results across batches.

### Strategic priorities prompt (Prompt 2B)

User message:
```
Extract strategic priorities from the following text of a Canadian post-secondary institution's strategic plan.

Return a JSON object with exactly this structure:
{
  "planName": "name of the strategic plan" | null,
  "planPeriodStart": "YYYY" | null,
  "planPeriodEnd": "YYYY" | null,
  "visionStatement": "the institution's vision statement" | null,
  "priorities": [
    {
      "priorityName": "name of the priority",
      "priorityDescription": "one to three sentence description",
      "pillar": "overarching theme or pillar this belongs to" | null,
      "progressStatus": one of "On Track", "At Risk", "Achieved", "Unknown",
      "keyInitiatives": ["initiative 1", "initiative 2", "..."]
    }
  ]
}

Extract all priorities, goals, or strategic directions mentioned. Return an empty array for "priorities" if none are found.

Document text (chunk {CHUNK_INDEX} of {TOTAL_CHUNKS}):
---
{CHUNK_TEXT}
---
```
Call with `jsonMode: true`. When processing multiple chunks: merge `priorities` arrays, deduplicate by `priorityName`, take first non-null `planName`/`visionStatement`.

### Sustainability prompt (Prompt 2C)

User message:
```
Extract sustainability and environmental data from the following text of a Canadian post-secondary institution's sustainability report.

Return a JSON object with exactly these fields (null for anything not found):
{
  "fiscalYear": "YYYY" | null,
  "ghgEmissionsTotal": number | null,
  "ghgScope1": number | null,
  "ghgScope2": number | null,
  "ghgScope3": number | null,
  "emissionsUnit": "tCO2e" or other unit if specified,
  "energyConsumption": number | null,
  "energyUnit": "GJ" or other unit if specified,
  "renewableEnergyPct": number | null,
  "wasteDiversionRate": number | null,
  "waterConsumption": number | null,
  "netZeroTargetYear": "YYYY" | null,
  "sustainabilityCertifications": ["cert 1", "cert 2"],
  "notes": "any important caveats"
}

Document text (chunk {CHUNK_INDEX} of {TOTAL_CHUNKS}):
---
{CHUNK_TEXT}
---
```
Call with `jsonMode: true`. Merge multi-chunk results: first non-null wins for scalars, union arrays for `sustainabilityCertifications`.

### Key facts prompt (Prompt 2D)

User message:
```
Extract key facts and data points from the following institutional document text. Focus on facts relevant to a consulting firm that advises Canadian post-secondary institutions.

Return a JSON object:
{
  "facts": [
    {
      "kpiName": "descriptive name for this data point",
      "kpiCategory": one of "Enrolment", "Research", "Financial", "Student Success", "Indigenous", "Sustainability", "Other",
      "value": number | null,
      "unit": "unit of measure" | null,
      "fiscalYear": "YYYY" | null,
      "notes": "context or clarification" | null
    }
  ]
}

Extract up to 25 of the most strategically relevant facts.

Document text (chunk {CHUNK_INDEX} of {TOTAL_CHUNKS}):
---
{CHUNK_TEXT}
---
```
Call with `jsonMode: true`. Merge multi-chunk `facts` arrays; deduplicate by `kpiName`.

---

## Extraction DB Writes

### File: `src/db/extractionDb.ts`

```ts
// Write a financial_summaries row (parameterized)
export function saveFinancials(institutionId: number, documentId: number, data: FinancialExtraction): void

// Write strategic_plans + strategic_priorities rows
export function saveStrategicPlan(institutionId: number, documentId: number, data: StrategicExtraction): void

// Write sustainability_metrics row
export function saveSustainability(institutionId: number, documentId: number, data: SustainabilityExtraction): void

// Write kpi_datapoints rows
export function saveKeyFacts(institutionId: number, documentId: number, facts: KeyFact[]): void
```

All functions use parameterized `execute()` from `src/db/db.ts`. Call `saveDb()` after each batch write.

---

## Processing Pipeline Orchestrator

### File: `src/services/processingPipeline.ts`

```ts
export async function runProcessingPipeline(
  documentId: number,
  institutionId: number,
  onStepChange: (step: ProcessingStep) => void,
  onClassified: (result: ClassificationResult) => Promise<ClassificationResult>  // user confirmation callback
): Promise<void>
```

Steps:
1. Load chunks from DB via `getChunks(documentId)`
2. `onStepChange('classifying')` → call `classifyDocument(chunks)`
3. `onStepChange('awaiting_confirmation')` → await `onClassified(result)` — the UI shows the confirmation modal and resolves with the (possibly edited) classification
4. `updateDocumentClassification(documentId, confirmed.documentType, confirmed.fiscalYear)`
5. `onStepChange('extracting_data')` — dispatch appropriate extraction call(s):
   - `Financial Statement` → `extractFinancials(chunks)` → `saveFinancials()`
   - `Strategic Plan` → `extractStrategicPriorities(chunks)` → `saveStrategicPlan()`
   - `Sustainability Report` → `extractSustainability(chunks)` → `saveSustainability()`
   - `Annual Report` → run all three above sequentially
   - `Other` → `extractKeyFacts(chunks)` → `saveKeyFacts()`
6. `onStepChange('writing_db')` → `saveDb()`
7. `updateDocumentStatus(documentId, 'Processed')`
8. `onStepChange('complete')`

Wrap entire pipeline in try/catch:
- On error: `updateDocumentStatus(documentId, 'Failed', error.message)`, `onStepChange('failed')`

---

## User Confirmation Modal

### File: `src/components/ClassificationConfirmModal.tsx`

Props:
```ts
{
  open: boolean
  result: ClassificationResult
  filename: string
  onConfirm: (confirmed: ClassificationResult) => void
  onCancel: () => void
}
```

UI:
- Modal overlay (not slide-over)
- Title: "Document Classification"
- Shows: "AI classified this document as:"
  - Document type (editable dropdown: Financial Statement, Strategic Plan, Sustainability Report, Annual Report, Other)
  - Fiscal year (editable text input)
  - Institution name detected (read-only, informational)
  - Confidence: shown as a percentage bar
- Two buttons: "Confirm & Extract" (primary green), "Cancel"

---

## Updated Document Upload Flow

In `src/components/DocumentUpload.tsx`, after chunking (end of Phase 2 flow), trigger the pipeline:

```ts
// After chunks saved:
const confirmed = await new Promise<ClassificationResult>((resolve) => {
  // Show ClassificationConfirmModal, resolve when user confirms
})
await runProcessingPipeline(docId, institutionId, setStep, async (result) => {
  // Show modal, wait for user to confirm, return confirmed result
  return confirmed
})
```

Wire `onStepChange` to update `ProcessingContext` so the status bar reflects live progress.

---

## Settings: Test Connection (activate)

In `src/pages/Settings.tsx`, replace the "Not implemented" stub:
```ts
const result = await testConnection()
showToast(result.success ? 'success' : 'error', result.message)
```

---

## Re-process Button

In `DocumentDetailPanel.tsx`, activate the "Re-process" button (was greyed out in Phase 2):
- Only enabled when `processing_status` is `'Failed'` or `'Processed'`
- Calls `runProcessingPipeline()` using the stored chunks (no re-upload needed)
- Shows confirmation dialog first: "This will overwrite existing extracted data for this document."

---

## Error Handling Summary

| Scenario | Behaviour |
|---|---|
| Azure config missing | Toast: "Please configure Azure OpenAI in Settings before processing." |
| Network error | Mark document Failed, show toast with error message |
| HTTP 429 | Wait 10s, retry up to 3 times silently |
| JSON parse failure | Retry once with "return only valid JSON" suffix; if still fails, mark Failed |
| Unexpected JSON shape | Log warning to console, show info toast "Partial data extracted — some fields may be missing" |

---

## Deliverable

After Phase 3:
1. Uploading a PDF runs the full pipeline: extract → classify → confirm → extract data → save to DB
2. Settings "Test Connection" works
3. Document status updates live in the UI
4. Re-process button works on failed/processed documents
5. Financials/priorities/sustainability/KPI data is in the DB (visible as raw rows — visualization comes in Phase 4)

Commit message: `feat(phase-3): Azure OpenAI integration, document classification and data extraction pipeline`
