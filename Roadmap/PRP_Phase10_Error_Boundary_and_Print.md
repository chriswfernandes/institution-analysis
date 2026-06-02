# PRP — Phase 10: Error Boundary & Print Report

## Context

Phases 1–9 are complete. Two hardening items remain that don't require an API key:

1. **Error boundary** — if any component throws a runtime error (e.g. malformed SQLite data, Recharts render failure), the entire app currently goes blank with no recovery path. A React Error Boundary catches this and shows a helpful fallback.
2. **Print report** — the app has rich per-institution data views but no way to share findings without screenshotting. A print stylesheet plus a "Print Report" button turns the Institution Detail page into a shareable one-pager.

---

## Part A: React Error Boundary

### New file: `src/components/ErrorBoundary.tsx`

React Error Boundaries must be class components:

```tsx
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-8">
          <div className="bg-white rounded-xl border border-red-200 p-8 max-w-lg text-center shadow">
            <p className="text-red-600 font-semibold text-lg mb-2">Something went wrong</p>
            <p className="text-sm text-slate-500 mb-4">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

### Integration: `src/components/Layout.tsx`

Wrap the `<Outlet />` with the error boundary:

```tsx
import { ErrorBoundary } from './ErrorBoundary'
// ...
<main ...>
  <ErrorBoundary>
    <Outlet />
  </ErrorBoundary>
</main>
```

---

## Part B: Print Report

### CSS: `src/index.css`

Add a `@media print` block at the end of the file:

```css
@media print {
  /* Hide chrome */
  header, nav, .no-print { display: none !important; }

  /* Remove sidebar offset */
  main { margin-left: 0 !important; padding: 0 !important; }

  /* Expand all tab content — hide tab nav, show all panels */
  [data-tab-nav] { display: none !important; }
  [data-tab-panel] { display: block !important; page-break-inside: avoid; }

  /* Charts: fix Recharts SVG sizing */
  .recharts-responsive-container { width: 100% !important; height: auto !important; }

  /* Full-width layout */
  body { font-size: 11pt; }
  .bg-white { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }

  /* Page breaks between major sections */
  section, .tab-section { page-break-inside: avoid; margin-bottom: 1.5rem; }
}
```

### `src/pages/InstitutionDetail.tsx`

1. Add `data-tab-nav` attribute to the tab navigation `<div>` and `data-tab-panel` to the tab content `<div>`.

2. Change the tab content block to render **all** tabs simultaneously when printing, not just the active one. Use a CSS approach: render all tab panels in the DOM, hide inactive ones normally, show all in print:

```tsx
// Replace the single conditional render with:
<div>
  <div data-tab-panel="" className={activeTab === 'overview' ? '' : 'hidden print:block'}>
    <OverviewTab ... />
  </div>
  <div data-tab-panel="" className={activeTab === 'financials' ? '' : 'hidden print:block'}>
    <FinancialsTab ... />
  </div>
  {/* ... all other tabs ... */}
</div>
```

3. Add a **"Print Report"** button to the institution header (next to "Run Full Analysis"):

```tsx
<button
  onClick={() => window.print()}
  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 no-print"
>
  <Printer size={14} /> Print Report
</button>
```

Import `Printer` from lucide-react.

---

## Tailwind print utilities

Tailwind v3 includes `print:` variant support out of the box. Use `print:block` on hidden tab panels so they render in print mode. Ensure `tailwind.config.js` content globs include all relevant files (already set to `./src/**/*.{ts,tsx}`).

---

## Reuse Notes

- `SlideOver`, `ConfirmDialog` — add `no-print` class to their root element so they are hidden when printing
- `ProcessingStatusBar` — add `no-print` class

---

## Deliverable

1. `npm run build` — no TypeScript errors
2. **Error boundary**: temporarily add `throw new Error('test')` inside `OverviewTab` → navigate to any institution → error boundary fallback shows with message and "Reload page" button → remove the throw
3. **Print**: Load sample data → UBC → click "Print Report" → browser print dialog opens → sidebar and header are hidden → all 6 tab sections are visible in the print preview (Overview, Financials, Strategic Priorities, KPIs, Sustainability, Insights)
4. Charts render in print preview (SVG scales correctly)
5. "Print Report" button itself is hidden in print preview
