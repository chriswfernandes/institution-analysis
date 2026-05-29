# PRP — Phase 4: Data Views

## Context

Phases 1–3 are complete. The app can upload PDFs, classify them, extract structured data via Azure OpenAI, and write it to SQLite. Financial summaries, strategic priorities, sustainability metrics, and KPI datapoints are now in the database.

This is **Phase 4**. Build all the data visualization tabs inside the institution detail view, plus flesh out the dashboard. No new AI calls — read and display what's already in the DB.

Install Recharts if not already installed:
```bash
npm install recharts
```

---

## Color Palette for Charts

Use these consistently across all Recharts components:

```ts
const CHART_COLORS = {
  revenue: '#16a34a',      // green-600
  expenses: '#dc2626',     // red-600
  surplus: '#2563eb',      // blue-600
  deficit: '#ea580c',      // orange-600
  neutral: '#475569',      // slate-600
}

// For multi-series breakdowns
const PALETTE = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#0891b2', '#ca8a04']
```

---

## Recharts Shared Config

- All charts: `<ResponsiveContainer width="100%" height={300}>`
- Axes: `<XAxis dataKey="..." tick={{ fill: '#475569', fontSize: 12 }} />`
- Grid: `<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />`
- Tooltip: custom tooltip component with white background, `border border-slate-200 rounded shadow-sm p-2`
- Legend: `<Legend wrapperStyle={{ fontSize: 12 }} />`
- Currency formatter: `(v: number) => '$' + (v / 1e6).toFixed(1) + 'M'` for financial values

---

## Institution Detail Tabs — Implementation

The tab structure is already in place from Phase 1. Replace each placeholder with real content.

### Overview Tab

**File:** `src/pages/tabs/OverviewTab.tsx`

Stat cards (2×2 grid):
- Total Documents (count from `documents` where `institution_id = id`)
- Processed Documents (count where `processing_status = 'Processed'`)
- Strategic Priorities (count from `strategic_priorities`)
- Latest Net Surplus/Deficit (most recent `financial_summaries.net_surplus_deficit` — show as `$XM`, coloured green if positive, red if negative)

Below the stat cards:
- "Latest Financials" section: show the most recent `financial_summaries` row as a simple key-value list (Total Revenue, Total Expenses, Net Surplus/Deficit, Fiscal Year)
- "Recent Documents" section: last 5 documents uploaded for this institution (filename, type badge, status badge, upload date)

---

### Financials Tab

**File:** `src/pages/tabs/FinancialsTab.tsx`

Read all `financial_summaries` rows for the institution, ordered by `fiscal_year ASC`.

**Section 1 — Multi-year trend chart**

`<BarChart>` with grouped bars (or `<ComposedChart>` with bars + line):
- X-axis: fiscal year
- Left bars: Total Revenue (green), Total Expenses (red)
- Line: Net Surplus/Deficit (blue, right Y-axis)
- If only 1 year of data: show a message "Upload more documents to see trends"

**Section 2 — Revenue breakdown (most recent year)**

`<PieChart>` or `<BarChart>` (horizontal) for most recent year's revenue sources:
- Segments: Tuition, Government Grants, Research, Investment Income, International Students, Other (calculated as Total Revenue minus known categories)
- Only show segments where value is non-null and > 0
- Show dollar amounts in tooltip

**Section 3 — Year-over-year change table**

A data table with columns: Fiscal Year, Total Revenue, Total Expenses, Net Surplus/Deficit, Total Assets, Total Liabilities.

For each column (except Fiscal Year): show the value AND a Δ% indicator compared to the prior year:
- Positive Δ: green arrow up + percentage
- Negative Δ: red arrow down + percentage
- First year: no indicator (no prior year)

Format all dollar values as `$X.XM` (millions, 1 decimal) or `$X.XB` if over 1 billion.

**Section 4 — Full data table**

Sortable (click column header) table of all `financial_summaries` rows. All columns from the schema. Values shown as formatted currency or `—` if null.

---

### Strategic Priorities Tab

**File:** `src/pages/tabs/StrategicPrioritiesTab.tsx`

Read all `strategic_priorities` rows for the institution, joined with `strategic_plans`.

**Filter bar:**
- Filter by `pillar` (dropdown, "All Pillars" default)
- Filter by `progress_status` (dropdown, "All Statuses" default)

**Plan info banner** (if `strategic_plans` row exists):
- Plan name, period (start–end), vision statement (expandable)

**Priorities cards** grouped by `pillar`:
- Pillar heading (bold, `text-slate-700`)
- Cards in a 1-column list:
  - Priority name (`font-semibold`)
  - Description (2-3 sentence paragraph)
  - Progress status badge: On Track (green), At Risk (orange), Achieved (blue), Unknown (slate)
  - Key initiatives: bulleted list (parse JSON array from `key_initiatives` column)

**Empty state:** "No strategic priorities extracted yet. Upload a Strategic Plan document to populate this tab."

---

### KPIs Tab

**File:** `src/pages/tabs/KPIsTab.tsx`

Read all `kpi_datapoints` rows for the institution.

**Filter bar:**
- Filter by `kpi_category` (dropdown, "All Categories" default)
- Filter by `fiscal_year` (dropdown, "All Years" default)
- Text search filtering `kpi_name`

**Table** grouped by `kpi_category` (collapsible sections):
- Group heading with count badge
- Columns: KPI Name, Value + Unit, Fiscal Year, Source Document (filename, linked to document detail)

Format values: if `unit` is `$` or `CAD`, format as currency; if `%`, append `%`; otherwise show raw value + unit.

---

### Sustainability Tab

**File:** `src/pages/tabs/SustainabilityTab.tsx`

Read all `sustainability_metrics` rows for the institution, ordered by `fiscal_year`.

**GHG Trend chart:**

`<LineChart>` with:
- X-axis: fiscal year
- Lines: Total GHG (solid, slate), Scope 1 (dashed, red), Scope 2 (dashed, orange), Scope 3 (dashed, yellow)
- Y-axis label: "tCO₂e"
- Only render lines that have at least 1 non-null data point

**Key indicators row** (stat cards, most recent year):
- Total GHG Emissions (tCO₂e)
- Renewable Energy %
- Waste Diversion Rate %
- Net Zero Target Year (or "Not Set")

**Certifications:**
- Show as badge chips (parse JSON array from `sustainability_certifications`)

**Data table:**
- All columns from `sustainability_metrics`, one row per fiscal year
- Null values shown as `—`

---

## Dashboard Page — Full Implementation

**File:** `src/pages/Dashboard.tsx`

Replace the Phase 1 placeholder.

**Top stat cards row (4 cards):**
- Total Institutions
- Total Documents
- Processed Documents
- Institutions with Insights (count of institutions that have at least 1 `analysis_findings` row)

**Recent Activity feed:**
- Last 10 documents uploaded across all institutions (most recent first)
- Each item: institution name (clickable → institution detail), filename, document type badge, status badge, relative time ("2 days ago")

**Institutions overview table:**
- All institutions with: name, province, type, document count, last upload date, tags
- Clicking a row navigates to `/institutions/:id`

---

## Shared Components

### `src/components/StatCard.tsx`

```tsx
// Props: title, value (string or number), subtitle?, trend? ('up'|'down'|null), trendValue? (string)
// Renders a white card with title, large value, optional subtitle, optional trend indicator
```

### `src/components/DataTable.tsx`

```tsx
// Props: columns: Column[], data: Record<string, any>[], onRowClick?: (row) => void
// Column: { key, label, render?: (value, row) => ReactNode, sortable?: boolean }
// Renders a sortable table with hover highlight on rows
```

---

## Non-Functional

- All charts use `<ResponsiveContainer>` — no fixed pixel widths
- Empty states shown for every tab when no data is available (not blank screens)
- Loading state while querying SQLite (show skeleton cards)
- All monetary values formatted consistently (`$X.XM`)

---

## Deliverable

After Phase 4:
1. Institution Financials tab shows multi-year chart, breakdown chart, and sortable table
2. Strategic Priorities tab shows grouped cards with filter controls
3. KPIs tab shows filterable grouped table
4. Sustainability tab shows GHG trend chart and data table
5. Overview tab shows summary stat cards and recent documents
6. Dashboard shows institution-wide stats and recent activity

Commit message: `feat(phase-4): financial charts, strategic priorities, KPI, and sustainability data views`
