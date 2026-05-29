# PRP — Phase 6: Polish & Advanced Features

## Context

Phases 1–5 are complete. The app has full institution CRUD, document ingestion, AI extraction, data views, and consulting insights. This is the final phase.

This is **Phase 6**. Add cross-institution comparison, the full themes view, global search, year-over-year indicators, and an accessibility + polish pass. After this phase the app is production-ready for consultants.

---

## Feature 1: Cross-Institution Comparison View

### Route: `/institutions/compare` (add to router)

Or trigger as a modal from the Institutions list page — either approach works. Recommend a dedicated page.

**File:** `src/pages/ComparisonView.tsx`

**Step 1 — Institution selector:**
- Multi-select checklist of all institutions (2–4 selectable, enforce max 4)
- Metric category selector: Financial, Enrolment KPIs, Sustainability
- "Compare" button

**Step 2 — Comparison display (after selection):**

For **Financial** comparison:
- `<BarChart>` with grouped bars — X-axis: fiscal year, one bar group per institution per year
- Metric switcher: Total Revenue / Total Expenses / Net Surplus/Deficit / Total Assets (tabs or dropdown)
- Side-by-side table: rows = fiscal years, columns = institution names, cells = formatted value

For **Enrolment KPIs** comparison:
- Filter to `kpi_category = 'Enrolment'`
- Show institutions side-by-side for each KPI name that appears in ≥2 selected institutions

For **Sustainability** comparison:
- `<LineChart>` with one line per institution — GHG total over years
- Side-by-side table: GHG total, Scope 1/2/3, Net Zero target year

Institution legend: each institution gets a colour from `PALETTE` (reuse from Phase 4).

Add "Compare Institutions" button to the Institutions list page header.

---

## Feature 2: Cross-Institution Themes View

### Route: `/analysis` (replace placeholder)

**File:** `src/pages/Analysis.tsx`

Two sections:

**Section 1 — Themes Map:**

A grid of theme cards. For each theme in `themes` table:
```
┌──────────────────────────────────┐
│ Theme Name (bold)                 │
│ {N} institutions                  │
│ [Inst. A] [Inst. B] [Inst. C]    │  ← small institution chips
└──────────────────────────────────┘
```
Clicking a theme card expands or navigates to a theme detail view (same page, below):
- Theme name + description
- Table: Institution, Relevance Score (stars), Evidence excerpt, Date Identified
- "View Institution" link on each row

**Section 2 — Theme Assignment:**
- Dropdown to select an institution
- List all themes with checkboxes — checked = this institution is tagged
- Relevance score (1–5 star picker) per checked theme
- "Save" button → writes/updates `institution_themes`

---

## Feature 3: Global Search

**File:** `src/components/GlobalSearch.tsx`

Replace the search placeholder in the header.

**UI:** A search input in the header (width expands on focus). As the user types (debounce 300ms), show a dropdown panel below:

```
┌───────────────────────────────────────┐
│ Institutions (2)                      │
│   🏛 University of Toronto            │
│   🏛 UBC                              │
├───────────────────────────────────────┤
│ Documents (3)                         │
│   📄 UofT_Annual_Report_2024.pdf      │
│   📄 UBC_Financial_Statement_2023.pdf │
├───────────────────────────────────────┤
│ Insights (1)                          │
│   💡 Digital Transformation Opportunity│
└───────────────────────────────────────┘
```

**Search logic** (pure SQLite queries, no full-text extension needed):

```ts
function search(query: string): SearchResults {
  const q = `%${query}%`
  return {
    institutions: query<...>(`
      SELECT id, name, short_code FROM institutions
      WHERE name LIKE ? OR short_code LIKE ?
      LIMIT 5`, [q, q]),
    documents: query<...>(`
      SELECT d.id, d.filename, i.name as institution_name
      FROM documents d JOIN institutions i ON d.institution_id = i.id
      WHERE d.filename LIKE ?
      LIMIT 5`, [q]),
    findings: query<...>(`
      SELECT f.id, f.title, f.institution_id, i.name as institution_name
      FROM analysis_findings f JOIN institutions i ON f.institution_id = i.id
      WHERE f.title LIKE ? OR f.narrative LIKE ?
      LIMIT 5`, [q, q]),
    priorities: query<...>(`
      SELECT sp.id, sp.priority_name, sp.institution_id, i.name as institution_name
      FROM strategic_priorities sp JOIN institutions i ON sp.institution_id = i.id
      WHERE sp.priority_name LIKE ?
      LIMIT 5`, [q]),
  }
}
```

**Navigation on click:**
- Institution → `/institutions/:id`
- Document → `/institutions/:institution_id` (Documents tab, highlight doc)
- Finding → `/institutions/:institution_id` (Insights tab)
- Priority → `/institutions/:institution_id` (Strategic Priorities tab)

Close dropdown on click-outside or Escape.

---

## Feature 4: Year-over-Year Change Indicators

**File:** update `src/pages/tabs/FinancialsTab.tsx`

Already stubbed in Phase 4. Implement fully:

```ts
function calcYoY(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}
```

Render in the data table as:
- `+X.X%` in green with `↑` icon if positive
- `-X.X%` in red with `↓` icon if negative
- `—` if no prior year data

Also add YoY sparklines in the Overview tab stat cards (tiny inline Recharts `<LineChart>` showing the trend for total revenue over years — 3-year window).

---

## Feature 5: Accessibility Pass

Apply these across the entire app:

**Focus states:** ensure all interactive elements have a visible focus ring:
```css
/* In index.css */
*:focus-visible {
  outline: 2px solid #16a34a;
  outline-offset: 2px;
}
```

**Form labels:** every `<input>`, `<select>`, `<textarea>` must have an associated `<label htmlFor="...">`. Audit all forms from Phases 1–5.

**Status badges text:** confirm every `<StatusBadge>` includes the status text, not just colour (already in spec but verify implementation).

**ARIA attributes:**
- Slide-over: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title
- Modal dialogs: same
- Navigation sidebar: `<nav aria-label="Main navigation">`, active link: `aria-current="page"`
- Chart containers: `aria-label` describing what the chart shows (e.g., `aria-label="Revenue and expenses by fiscal year"`)

**Tab order:** ensure logical tab order through forms. No `tabIndex` > 0.

---

## Feature 6: UI Polish

**Skeleton loaders:** anywhere data is loading async (tab switch, search results, analysis running), show skeleton shimmer placeholders instead of blank screens.

```tsx
// src/components/Skeleton.tsx
// <Skeleton className="h-4 w-32" /> renders an animated grey shimmer bar
```

Use these in:
- Institution detail tabs (while querying SQLite)
- Global search dropdown (while debouncing)
- Dashboard stat cards (on initial load)

**Sidebar collapse persistence:** save collapsed state to `localStorage` key `sidebar_collapsed`.

**Empty states:** audit every tab/page — every empty state should have:
- An icon (Lucide)
- A heading: "No [X] yet"
- A 1-sentence explanation
- An action button where applicable (e.g., "Upload Document", "Add Institution")

**Toast deduplication:** if the same message is toasted twice within 2 seconds, suppress the duplicate.

**Responsive layout:**
- Sidebar: auto-collapse to icon-only at `<768px`
- Institution cards grid: 1 col on mobile, 2 cols at `md:`, 3 cols at `xl:`
- Charts: already responsive via `ResponsiveContainer`

---

## Final Checklist Before Commit

- [ ] `npm run build` completes with no TypeScript errors
- [ ] All routes navigate correctly
- [ ] Institution CRUD works end-to-end
- [ ] PDF upload → extraction → classification → confirmation → data written to DB
- [ ] Financial charts render with data
- [ ] Run Full Analysis → findings appear in Insights tab
- [ ] Global search returns results
- [ ] Cross-institution comparison renders chart
- [ ] Themes view shows institutions per theme
- [ ] Export/import DB works (export .db, reimport, data persists)
- [ ] No `console.error` in the browser during normal usage
- [ ] All form fields have labels
- [ ] Focus rings visible on keyboard navigation

---

## Deliverable

After Phase 6:
1. Cross-institution comparison view works with charts and tables
2. Themes view shows all institutions tagged per theme with edit capability
3. Global search returns results across all content types
4. Year-over-year indicators show in the financials table
5. Accessibility and polish applied throughout

Commit message: `feat(phase-6): cross-institution comparison, themes view, global search, YoY indicators, accessibility polish`
