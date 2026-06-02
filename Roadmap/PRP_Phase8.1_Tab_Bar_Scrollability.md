# PRP Phase 8.1 — Institution Detail Tab Bar Scrollability

## Problem

The Institution Detail page has 7 tabs (Overview, Documents, Financials, Strategic Priorities, KPIs, Sustainability, Insights). On screens narrower than ~1100px the tab bar overflows its container and the rightmost tabs (Financials, KPIs, Strategic Priorities, Sustainability) are clipped and unreachable.

Root cause: the tab bar `<div>` uses `overflow-x-auto` but also carries a `border-b border-slate-200` decoration. The `overflow: auto` creates a new formatting context that clips the active-tab indicator (a negative-margin `border-b-2`) and makes the scrollable area hard to discover with no scroll indicator on most desktop browsers.

---

## Goal

All 7 tabs must be reachable at any viewport width. The active-tab underline indicator must remain visible. The fix must require no new components or dependencies.

---

## Approach

Wrap the tab buttons in a dedicated scroll container that is isolated from the bottom border. The border-b line is drawn by a sibling element (or via `pb-px` padding + negative margin trick) so it is never clipped.

### Pattern

```tsx
{/* Tabs */}
<div className="relative border-b border-slate-200 mb-4">
  <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
    {TABS.map(({ key, label, icon: Icon }) => (
      <button
        key={key}
        onClick={() => setActiveTab(key)}
        aria-current={activeTab === key ? 'page' : undefined}
        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
          activeTab === key
            ? 'border-green-600 text-green-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
      >
        <Icon size={14} />
        {label}
      </button>
    ))}
  </div>
</div>
```

Key changes vs current code:
- Outer `<div>` owns `border-b border-slate-200` and `mb-4` (static, never clipped)
- Inner `<div>` owns `overflow-x-auto` and `-mb-px` (pulls the scroll container up 1px so active-tab `border-b-2` overlaps the parent border seamlessly)
- Each button gets `shrink-0` so it never compresses below its natural width
- `scrollbar-hide` utility (already used elsewhere in the project) hides the native scrollbar on desktop while keeping scroll behaviour

### Utility class

`scrollbar-hide` is added via the Tailwind plugin already present in `tailwind.config.ts` (`tailwind-scrollbar-hide`). Verify it is installed; if not, add a small inline CSS rule in `src/index.css`:

```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## Files Modified

| File | Change |
|---|---|
| `src/pages/InstitutionDetail.tsx` | Replace tab bar div structure as above |
| `src/index.css` | Add `.scrollbar-hide` rule if plugin absent |

---

## Verification

1. `npm run build` — no TypeScript errors
2. Resize browser to 768px wide → all 7 tabs reachable by horizontal scroll
3. Active tab shows green underline, flush with the horizontal rule
4. At full desktop width (~1440px) all tabs visible without scrolling
