# PRP — Phase 13: Re-process Guard (Upsert Extraction Writes)

## Context

The four `save*` functions in `src/db/extractionDb.ts` all use plain `INSERT`. When a document is re-processed (e.g. because the first pass failed or the user wants to refresh the data), the pipeline writes new rows without removing the old ones. This creates duplicates:

- Two `financial_summaries` rows for FY 2023 from the same document
- Ten `strategic_priorities` instead of five
- Two identical `sustainability_metrics` rows

This phase changes all four save functions to **delete existing rows for that document before inserting**, making re-processing idempotent. It also adds a low-confidence warning to the classification step so the user is alerted when the AI is uncertain about the document type.

---

## Part A — Idempotent save functions (`src/db/extractionDb.ts`)

### `saveFinancials`

```ts
export function saveFinancials(
  institutionId: number,
  documentId: number,
  data: FinancialExtraction
): void {
  // Remove any existing rows from a previous extraction of this document
  execute('DELETE FROM financial_summaries WHERE document_id = ?', [documentId])

  execute(
    `INSERT INTO financial_summaries (
      institution_id, document_id, fiscal_year, ...
    ) VALUES (?, ?, ?, ...)`,
    [institutionId, documentId, ...]
  )
  saveDb()
}
```

### `saveStrategicPlan`

```ts
export function saveStrategicPlan(...): void {
  // Remove priorities first (FK child), then the plan
  execute('DELETE FROM strategic_priorities WHERE document_id = ?', [documentId])
  execute('DELETE FROM strategic_plans WHERE document_id = ?', [documentId])

  // Then insert plan + priorities as before
}
```

### `saveSustainability`

```ts
export function saveSustainability(...): void {
  execute('DELETE FROM sustainability_metrics WHERE document_id = ?', [documentId])
  // Then insert as before
}
```

### `saveKeyFacts`

```ts
export function saveKeyFacts(...): void {
  execute('DELETE FROM kpi_datapoints WHERE document_id = ?', [documentId])
  // Then insert all facts
}
```

---

## Part B — Low-confidence classification warning (`src/services/processingPipeline.ts`)

After `classifyDocument()` returns a result, check the confidence score before invoking `onClassified`:

```ts
const classificationResult = await classifyDocument(chunks)

// Attach a flag so the confirmation modal can show a warning
const resultWithFlag = {
  ...classificationResult,
  lowConfidence: (classificationResult.confidence ?? 1) < 0.6,
}

const confirmed = await onClassified(resultWithFlag)
```

### `src/types/index.ts`

Add `lowConfidence?: boolean` to `ClassificationResult`.

### `src/components/ClassificationConfirmModal.tsx`

When `result.lowConfidence` is true, show a yellow warning banner above the form:

```tsx
{result.lowConfidence && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-3">
    ⚠ Low confidence ({((result.confidence ?? 0) * 100).toFixed(0)}%) — please verify the document type before proceeding.
  </div>
)}
```

---

## Part C — Re-process confirmation improvement (`src/components/DocumentDetailPanel.tsx`)

The existing "Re-process" ConfirmDialog message should mention that existing extractions will be replaced:

```ts
message="This will replace all existing extracted data for this document (financials, priorities, KPIs, sustainability). Continue?"
```

---

## Files Modified

| File | Change |
|---|---|
| `src/db/extractionDb.ts` | Add DELETE before INSERT in all four save functions |
| `src/services/processingPipeline.ts` | Attach `lowConfidence` flag based on confidence threshold |
| `src/types/index.ts` | Add `lowConfidence?: boolean` to `ClassificationResult` |
| `src/components/ClassificationConfirmModal.tsx` | Show amber warning banner when `lowConfidence` is true |
| `src/components/DocumentDetailPanel.tsx` | Update re-process confirm message |

---

## Verification

1. `npm run build` — no TypeScript errors
2. Load sample data → UBC → Documents → process UBC 2023 Annual Report → note how many rows appear in Financials and KPIs tabs
3. Re-process the same document → row counts stay the same (no duplicates)
4. Manually test: set `confidence: 0.4` in a mock classification result → ClassificationConfirmModal shows the amber low-confidence banner
5. Re-process confirm dialog message now mentions "will replace all existing extracted data"
