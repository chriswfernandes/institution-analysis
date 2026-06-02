# PRP — Phase 7: Manual Data Entry Forms

## Context

Phases 1–6 are complete. All data views, AI pipelines, and export infrastructure exist, but every structured data record currently comes from AI extraction of an uploaded PDF — which requires an Azure OpenAI key. Users with no API key, or who simply want to correct AI-extracted figures, have no way to enter or edit financial summaries, strategic priorities, KPIs, or sustainability metrics by hand. This phase adds inline "Add / Edit / Delete" capabilities to each data tab, making the app fully usable without any LLM connection.

---

## Implementation

### Shared infrastructure

**`src/db/extractionDb.ts`** — add delete functions for each data type:

```ts
export function deleteFinancialSummary(id: number): void
export function deleteStrategicPriority(id: number): void
export function deleteKpiDatapoint(id: number): void
export function deleteSustainabilityMetric(id: number): void
```

Each runs `execute('DELETE FROM <table> WHERE id = ?', [id])` then `saveDb()`.

Also add upsert functions for manual entry (INSERT when no `id`, UPDATE when `id` provided):

```ts
export function upsertFinancialSummary(institutionId: number, data: Partial<FinancialExtraction> & { id?: number; fiscal_year: string }): void
export function upsertStrategicPriority(institutionId: number, data: { id?: number; priority_name: string; pillar: string | null; progress_status: string; priority_description: string | null; key_initiatives: string[] }): void
export function upsertKpiDatapoint(institutionId: number, data: { id?: number } & KeyFact): void
export function upsertSustainabilityMetric(institutionId: number, data: Partial<SustainabilityExtraction> & { id?: number; fiscal_year: string }): void
```

Use `INSERT OR REPLACE` keyed on `id` when updating, plain `INSERT` when adding.

---

### Phase 7A — Financial Summaries (`src/pages/tabs/FinancialsTab.tsx`)

**Add button** in the tab header: `+ Add Entry` (green, small). Opens a `SlideOver` titled "Add Financial Summary" (or "Edit Financial Summary" when editing).

**Form fields** (all in a single scrollable slide-over):
- Fiscal Year* (text input, e.g. `2023`)
- Revenue section: Total Revenue, Operating Revenue, Government Grants, Tuition Revenue, Research Revenue, Investment Income, International Student Revenue
- Expenses section: Total Expenses, Operating Expenses
- Net Surplus / Deficit (auto-calculated from total_revenue − total_expenses if left blank, but overridable)
- Balance Sheet: Total Assets, Total Liabilities, Net Assets, Endowment Value
- Notes (textarea)

All currency fields: `<input type="number" step="1000">` — no dollar formatting during entry, show raw number.

**Edit / Delete** on each row in the existing YoY data table:
- Pencil icon → opens the same form pre-populated
- Trash icon → `ConfirmDialog` → delete

On save: call `upsertFinancialSummary()`, close slide-over, reload tab data, success toast.

---

### Phase 7B — Strategic Priorities (`src/pages/tabs/StrategicPrioritiesTab.tsx`)

**Add button** in the tab header: `+ Add Priority`.

**Form fields:**
- Priority Name* (text)
- Pillar (text, with `<datalist>` populated from existing pillar values for this institution)
- Progress Status (select: On Track / At Risk / Achieved / Unknown)
- Description (textarea)
- Key Initiatives (textarea — one initiative per line; split on `\n` and store as JSON array)

**Edit / Delete** on each priority card (small pencil + trash icons in the card footer).

On save: call `upsertStrategicPriority()`, close slide-over, reload tab data, success toast.

---

### Phase 7C — KPI Datapoints (`src/pages/tabs/KPIsTab.tsx`)

**Add button** in the tab header: `+ Add KPI`.

**Form fields:**
- KPI Name* (text)
- Category (text with `<datalist>` of existing categories for this institution: Enrolment, Research, Financial, Student Success, etc.)
- Value (number)
- Unit (text, e.g. `students`, `%`, `CAD`)
- Fiscal Year (text)
- Notes (textarea)

**Delete** on each row: small trash icon. No inline edit needed — delete and re-add is acceptable for KPIs.

On save: call `upsertKpiDatapoint()`, close slide-over, reload tab data, success toast.

---

### Phase 7D — Sustainability Metrics (`src/pages/tabs/SustainabilityTab.tsx`)

**Add button** in the tab header: `+ Add Year`.

**Form fields:**
- Fiscal Year* (text)
- GHG Emissions Total (number, tCO₂e)
- GHG Scope 1 (number)
- GHG Scope 2 (number)
- GHG Scope 3 (number)
- Energy Consumption (number, GJ)
- Renewable Energy % (number, 0–100)
- Waste Diversion Rate % (number, 0–100)
- Water Consumption (number, m³)
- Net Zero Target Year (text)
- Sustainability Certifications (text — comma-separated)

**Edit / Delete** on each row in the data table (pencil + trash icons).

On save: call `upsertSustainabilityMetric()`, close slide-over, reload tab data, success toast.

---

## Reuse Notes

- `SlideOver` from `src/components/SlideOver.tsx` — use as the form container
- `ConfirmDialog` from `src/components/ConfirmDialog.tsx` — use for all delete confirmations
- `useToast` from `src/components/useToast.ts` — success/error feedback
- `saveDb()` from `src/db/db.ts` — must be called after every write
- Input styling: use existing `.input` CSS class from `src/index.css`

---

## Deliverable

1. `npm run build` — no TypeScript errors
2. Institution detail → Financials tab → `+ Add Entry` → fill form → new row appears in YoY table and chart updates
3. Edit an existing financial row → figures updated on save
4. Delete a financial row → confirm dialog → row removed, chart updates
5. Same add/edit/delete flow works on Strategic Priorities, KPIs, and Sustainability tabs
6. All entries persist after page reload (stored in localStorage via SQLite blob)
