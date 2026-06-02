# PRP — Phase 13: Extraction Review UI

## Context

When the AI extraction pipeline runs, it writes rows to `financial_summaries`, `strategic_priorities`, `sustainability_metrics`, and `kpi_datapoints`. Currently there is no way to see what was written for a specific document, verify it is correct, or remove a bad extraction without going through the full per-tab data tables and manually hunting for the right rows.

This phase adds an **Extraction Review** panel to the Document Detail slide-over: a collapsible summary of everything the pipeline wrote for that document, with inline delete on each extracted row and a link to navigate to the relevant tab for editing.

---

## Scope

No new tables required. All data is already in the database — this is purely a read + delete UI.

---

## Changes: `src/components/DocumentDetailPanel.tsx`

### New section below the existing metadata grid

Render an "Extracted Data" section when `doc.processing_status === 'processed'`.

Query each extraction table for rows linked to this document:

```ts
interface ExtractionSummary {
  financials: { id: number; fiscal_year: string | null }[]
  priorities: { id: number; priority_name: string }[]
  sustainability: { id: number; fiscal_year: string | null }[]
  kpis: { id: number; kpi_name: string; kpi_category: string | null; fiscal_year: string | null }[]
}

function getExtractionSummary(documentId: number): ExtractionSummary {
  return {
    financials: query('SELECT id, fiscal_year FROM financial_summaries WHERE document_id = ?', [documentId]),
    priorities: query('SELECT id, priority_name FROM strategic_priorities WHERE document_id = ?', [documentId]),
    sustainability: query('SELECT id, fiscal_year FROM sustainability_metrics WHERE document_id = ?', [documentId]),
    kpis: query('SELECT id, kpi_name, kpi_category, fiscal_year FROM kpi_datapoints WHERE document_id = ?', [documentId]),
  }
}
```

Load this summary into state when the panel opens (`useEffect` on `documentId`). Reload it after any delete.

### UI layout

Collapsible section titled **"Extracted Data"** (toggle with a ChevronDown/ChevronUp button). Default: expanded.

For each table that has rows, render a group:

```
● Financial Summaries (2 rows)
  · FY 2022   [✕]
  · FY 2023   [✕]

● Strategic Priorities (5 rows)
  · Advancing Research Excellence   [✕]
  · Transforming Learning Experiences   [✕]
  ...

● Sustainability Metrics (1 row)
  · FY 2023   [✕]

● KPI Datapoints (8 rows)
  · Total Student Enrolment · Enrolment · 2023   [✕]
  ...
```

Each `[✕]` is a small Trash2 icon button. Clicking it:
1. Calls the appropriate `deleteFinancialSummary(id)` / `deleteStrategicPriority(id)` / `deleteSustainabilityMetric(id)` / `deleteKpiDatapoint(id)` from `extractionDb.ts`
2. Reloads the extraction summary
3. Shows a brief toast: "Financial summary (FY 2022) deleted"

If all four tables are empty for this document, show:
```
No extracted data for this document.
```

### "Clear All Extractions" button

Below the groups, a small danger button: **"Clear All Extractions"**. Clicking it shows a ConfirmDialog. On confirm: deletes all rows across all four tables for this document, reloads summary, shows toast.

---

## New helper: `src/db/extractionDb.ts`

Add `clearExtractionsForDocument(documentId: number): void`:

```ts
export function clearExtractionsForDocument(documentId: number): void {
  execute('DELETE FROM financial_summaries WHERE document_id = ?', [documentId])
  execute('DELETE FROM strategic_priorities WHERE document_id = ?', [documentId])
  execute('DELETE FROM sustainability_metrics WHERE document_id = ?', [documentId])
  execute('DELETE FROM kpi_datapoints WHERE document_id = ?', [documentId])
  saveDb()
}
```

---

## Files Modified

| File | Change |
|---|---|
| `src/components/DocumentDetailPanel.tsx` | Add Extracted Data section with per-row delete |
| `src/db/extractionDb.ts` | Add `clearExtractionsForDocument()` |

---

## Reuse

- `deleteFinancialSummary`, `deleteStrategicPriority`, `deleteSustainabilityMetric`, `deleteKpiDatapoint` — already in `extractionDb.ts` from Phase 7
- `ConfirmDialog` — already in `src/components/ConfirmDialog.tsx`
- `useToast` — already in `src/components/useToast.ts`
- `query` — already in `src/db/db.ts`

---

## Verification

1. `npm run build` — no TypeScript errors
2. Load sample data → UBC → Documents tab → click the 2023 Annual Report document
3. Document panel opens → "Extracted Data" section shows financial summaries, strategic priorities, sustainability metrics, KPIs all populated
4. Click ✕ on "FY 2022" financial summary → row disappears from the panel → toast shows → navigate to Financials tab → FY 2022 row is gone
5. "Clear All Extractions" → confirm → all groups show empty → navigate to all four tabs → all rows for that document are removed
6. A document with `processing_status = 'pending'` or `'failed'` does not show the Extracted Data section
