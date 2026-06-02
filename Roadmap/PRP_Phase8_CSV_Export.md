# PRP — Phase 8: CSV Export

## Context

Phases 1–7 are complete. The app holds rich structured data (financials, KPIs, strategic priorities, sustainability metrics, insights, institution lists) but offers no way to get that data out in a format usable in Excel, PowerPoint, or other tools. The only export today is a binary `.db` file. This phase adds one-click CSV downloads on every data table, enabling users to prepare client-ready deliverables without an API key.

---

## Implementation

### Shared utility: `src/utils/exportCsv.ts` (new file)

```ts
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void
```

Implementation:
1. If `rows` is empty, return early (show a toast from the call site instead)
2. Derive headers from `Object.keys(rows[0])`
3. Build CSV string: header row + data rows, values wrapped in `"` with internal `"` escaped as `""`
4. Create `new Blob([csv], { type: 'text/csv;charset=utf-8;' })`
5. `URL.createObjectURL(blob)` → create temporary `<a>` → `.click()` → revoke URL

No external dependencies.

---

### Export targets

All export buttons use the same `Download` icon from lucide-react, placed in the section header to the right of any existing filter controls.

**Financial tab** (`src/pages/tabs/FinancialsTab.tsx`)
- Button label: "Export CSV"
- Queries: all `financial_summaries` rows for the institution
- Filename: `{short_code}_financials.csv`
- Columns: fiscal_year, total_revenue, total_expenses, net_surplus_deficit, operating_revenue, operating_expenses, government_grants, tuition_revenue, research_revenue, investment_income, total_assets, total_liabilities, net_assets, endowment_value, international_student_revenue, notes

**KPIs tab** (`src/pages/tabs/KPIsTab.tsx`)
- Button label: "Export CSV"
- Respects active category/year/search filters — exports only currently visible rows
- Filename: `{short_code}_kpis.csv`
- Columns: kpi_name, kpi_category, value, unit, fiscal_year, notes

**Strategic Priorities tab** (`src/pages/tabs/StrategicPrioritiesTab.tsx`)
- Button label: "Export CSV"
- Exports all priorities regardless of active filters
- Filename: `{short_code}_priorities.csv`
- Columns: priority_name, pillar, progress_status, priority_description, key_initiatives (JSON array → joined with ` | `)

**Sustainability tab** (`src/pages/tabs/SustainabilityTab.tsx`)
- Button label: "Export CSV"
- Filename: `{short_code}_sustainability.csv`
- Columns: fiscal_year, ghg_emissions_total, ghg_scope_1, ghg_scope_2, ghg_scope_3, energy_consumption, renewable_energy_pct, waste_diversion_rate, water_consumption, net_zero_target_year, sustainability_certifications

**Insights tab** (`src/pages/tabs/InsightsTab.tsx`)
- Button label: "Export CSV" (only shown when a run is selected)
- Exports findings for the currently selected run
- Filename: `{short_code}_insights_{run_id}.csv`
- Columns: finding_type, title, narrative (markdown stripped to plain text), priority_rank, relevant_service_line

**Institutions list** (`src/pages/Institutions.tsx`)
- Add "Export CSV" button in the page header (next to the existing "Compare" button)
- Exports the currently filtered institution list
- Filename: `institutions.csv`
- Columns: name, short_code, province, institution_type, website, notes, tags (comma-joined names), document_count

**Comparison view** (`src/pages/ComparisonView.tsx`)
- Add "Export CSV" button below each chart/table pair (only shown when ≥2 institutions selected)
- Exports whatever table is currently displayed
- Filename: `comparison_{metric}_{YYYY-MM-DD}.csv`

---

## Reuse Notes

- `useToast` from `src/components/useToast.ts` — show error toast if no data to export
- Institution `short_code` is available from existing state/props in every tab
- `query()` from `src/db/db.ts` — use for fresh queries at export time (don't rely on component state which may be filtered)

---

## Deliverable

1. `npm run build` — no TypeScript errors
2. Load sample data → UBC → Financials tab → "Export CSV" → downloads `UBC_financials.csv` with correct headers and 2 rows (2022, 2023)
3. KPIs tab → filter to "Enrolment" category → "Export CSV" → downloaded file contains only Enrolment KPIs
4. Institutions page → "Export CSV" → downloads all institutions with tag names joined by comma
5. Comparison view → select UBC + UToronto → Financial comparison → "Export CSV" → table data downloads correctly
6. Insights tab → select a run → "Export CSV" → findings download with plain-text narrative
7. Clicking "Export CSV" when a table has no rows shows an error toast "No data to export"
