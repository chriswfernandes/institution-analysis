# PRP Phase 8.2 — Sample Data Backfill

## Problem

Users who ran the app before Phase 4.1 (seed data) was merged have a
localStorage database that contains UBC and U of T institutions but none
of their related rows (financial_summaries, strategic_priorities,
kpi_datapoints, sustainability_metrics). Because `seedDatabase()` guards
on `WHERE short_code IN ('UBC','UOFT')`, it throws "Seed data already
loaded" and the missing rows are never inserted.

Result: the Financials, KPIs, Strategic Priorities, and Sustainability
tabs all show empty states for every institution, making those tabs
appear useless.

---

## Goal

All four data tabs show real content immediately after loading the app,
regardless of when the user first ran it.

---

## Approach

Add a **`backfillSeedData()`** function in `src/db/seedData.ts` that is
called from `src/db/db.ts` after the schema is initialized. It checks
whether sample data already exists for UBC/U of T and inserts only the
missing rows — it never duplicates and never throws.

Also add a **"Reset to Sample Data"** button in the Settings page that
calls `clearAndReseed()` — drops all non-schema data and re-runs the
full seed. This gives users a reliable escape hatch if their database
gets into a bad state.

---

## Step 1 — `src/db/seedData.ts`

### Add `backfillSeedData()`

```ts
export function backfillSeedData(): void {
  // Only backfill if UBC and UOFT exist
  const ubc = query<{ id: number }>(
    "SELECT id FROM institutions WHERE short_code = 'UBC'"
  )[0]
  const uoft = query<{ id: number }>(
    "SELECT id FROM institutions WHERE short_code = 'UOFT'"
  )[0]
  if (!ubc || !uoft) return   // full seedDatabase() will handle it

  _backfillFinancials(ubc.id, uoft.id)
  _backfillPriorities(ubc.id, uoft.id)
  _backfillKpis(ubc.id, uoft.id)
  _backfillSustainability(ubc.id, uoft.id)
  saveDb()
}
```

Each private helper checks `COUNT(*)` for that institution before
inserting, so running it repeatedly is safe:

```ts
function _backfillFinancials(ubcId: number, uoftId: number): void {
  const exists = query<{ c: number }>(
    'SELECT COUNT(*) as c FROM financial_summaries WHERE institution_id = ?',
    [ubcId]
  )[0]?.c ?? 0
  if (exists > 0) return    // already seeded
  // ... INSERT statements identical to the ones in seedDatabase()
}
// same pattern for _backfillPriorities, _backfillKpis, _backfillSustainability
```

### Add `clearAndReseed()`

```ts
export function clearAndReseed(): void {
  const tables = [
    'financial_summaries', 'strategic_priorities', 'strategic_plans',
    'kpi_datapoints', 'sustainability_metrics', 'analysis_runs',
    'analysis_findings', 'institution_themes', 'documents',
    'institution_tags', 'institutions', 'tags',
  ]
  for (const t of tables) execute(`DELETE FROM ${t}`)
  seedDatabase()    // existing function, runs clean
}
```

---

## Step 2 — `src/db/db.ts`

After the schema is initialized (inside `initDb()`), call the backfill:

```ts
import { backfillSeedData } from './seedData'

// inside initDb(), after initSchema():
try {
  backfillSeedData()
} catch {
  // non-fatal — user can fix via Settings
}
```

This runs once on page load. If the data is already present the helpers
return immediately (cheap COUNT query), so there is no performance cost
on normal loads.

---

## Step 3 — Settings page (`src/pages/Settings.tsx`)

Add a "Sample Data" danger zone section at the bottom:

```tsx
<section className="border border-red-200 rounded-xl p-6">
  <h2 className="text-base font-semibold text-red-700 mb-1">Reset Database</h2>
  <p className="text-sm text-slate-500 mb-4">
    Deletes all institutions, documents, and extracted data, then
    reloads the UBC / U of T sample dataset. This cannot be undone.
  </p>
  <button
    onClick={() => setConfirmReset(true)}
    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
  >
    Reset to Sample Data
  </button>
</section>
```

On confirm: call `clearAndReseed()`, dispatch `SET_INSTITUTIONS` with
the fresh institution list, show success toast, navigate to
`/institutions`.

---

## Files Modified

| File | Change |
|---|---|
| `src/db/seedData.ts` | Add `backfillSeedData()` and `clearAndReseed()` |
| `src/db/db.ts` | Call `backfillSeedData()` after `initSchema()` |
| `src/pages/Settings.tsx` | Add Reset to Sample Data danger zone |

---

## Verification

1. `npm run build` — no TypeScript errors
2. **Existing stale db** (UBC/UOFT present, no financials): reload page →
   Financials, KPIs, Priorities, Sustainability tabs all show data
3. **Fresh db** (no institutions): `seedDatabase()` runs as before,
   `backfillSeedData()` is a no-op
4. **Already-seeded db**: `backfillSeedData()` runs, COUNT checks return
   > 0, all helpers return immediately — no duplicates
5. Settings → Reset to Sample Data → confirm → institutions list shows
   UBC and U of T with full data across all tabs
