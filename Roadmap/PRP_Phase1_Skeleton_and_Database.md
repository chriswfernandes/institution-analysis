# PRP — Phase 1: Skeleton & Database

## Context

You are building the **HE Industry Tracker**, an internal practice intelligence tool for the Deloitte Canada GPS Higher Education consulting team. It is a locally-run React SPA (no backend, no auth) that lets consultants manage Canadian post-secondary institutions, upload documents, and view AI-extracted intelligence.

This is **Phase 1**. There is no existing code — you are creating the project from scratch. Your goal is a fully working app shell with the database layer, navigation, settings, and institution CRUD. No AI calls and no document processing yet.

After this phase, a consultant should be able to open the app, navigate between pages, add/edit/delete institutions, manage tags, and configure their Azure OpenAI credentials.

---

## Tech Stack

- **React 18** + **Vite 5** + **TypeScript 5**
- **Tailwind CSS v3** (utility-first styling)
- **sql.js v1.10.3** (SQLite compiled to WASM — runs entirely in the browser)
- **react-router-dom v6** (SPA routing)
- **lucide-react** (icons)
- No Redux, no Zustand — use React Context + `useReducer` for global state

---

## Project Setup

Scaffold with:
```bash
npm create vite@latest . -- --template react-ts
npm install react-router-dom sql.js lucide-react tailwindcss @tailwindcss/forms postcss autoprefixer
npx tailwindcss init -p
```

### `vite.config.ts` — critical for sql.js WASM

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})
```

### `tailwind.config.js`

```js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Add to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Color System (use these Tailwind classes throughout)

| Role | Class |
|---|---|
| Primary (sidebar bg, header) | `bg-slate-800` / `text-white` |
| Accent (active nav, buttons) | `bg-green-600` / `text-green-600` |
| Surface | `bg-white` / `bg-slate-50` |
| Border | `border-slate-200` |
| Heading text | `text-slate-900` |
| Body text | `text-slate-600` |
| Muted text | `text-slate-400` |

Status badge classes (reuse as a `<StatusBadge>` component):
- Processed: `bg-green-100 text-green-700`
- Processing: `bg-blue-100 text-blue-700`
- Pending: `bg-yellow-100 text-yellow-700`
- Failed: `bg-red-100 text-red-700`

---

## Database Layer

### File: `src/db/schema.ts`

Export a single `SCHEMA_SQL` string containing all `CREATE TABLE IF NOT EXISTS` statements for these 13 tables. Use the exact column definitions below.

```sql
-- Group A: Core
CREATE TABLE IF NOT EXISTS institutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  province TEXT,
  institution_type TEXT,
  website TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  colour TEXT
);

CREATE TABLE IF NOT EXISTS institution_tags (
  institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (institution_id, tag_id)
);

-- Group B: Document Ingestion
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  document_type TEXT,
  fiscal_year TEXT,
  upload_date TEXT DEFAULT (datetime('now')),
  processing_status TEXT DEFAULT 'Pending',
  processing_error TEXT,
  page_count INTEGER,
  word_count INTEGER,
  raw_text TEXT
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_estimate INTEGER
);

-- Group C: Structured Data
CREATE TABLE IF NOT EXISTS financial_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  fiscal_year TEXT NOT NULL,
  total_revenue REAL, total_expenses REAL, net_surplus_deficit REAL,
  operating_revenue REAL, operating_expenses REAL,
  government_grants REAL, tuition_revenue REAL, research_revenue REAL,
  investment_income REAL, total_assets REAL, total_liabilities REAL,
  net_assets REAL, endowment_value REAL, international_student_revenue REAL,
  notes TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategic_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  plan_name TEXT, plan_period_start TEXT, plan_period_end TEXT,
  vision_statement TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategic_priorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  strategic_plan_id INTEGER REFERENCES strategic_plans(id),
  document_id INTEGER REFERENCES documents(id),
  priority_name TEXT NOT NULL, priority_description TEXT,
  pillar TEXT, progress_status TEXT, key_initiatives TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kpi_datapoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  kpi_name TEXT NOT NULL, kpi_category TEXT, fiscal_year TEXT,
  value REAL, unit TEXT, notes TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sustainability_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  fiscal_year TEXT,
  ghg_emissions_total REAL, ghg_scope_1 REAL, ghg_scope_2 REAL, ghg_scope_3 REAL,
  energy_consumption REAL, renewable_energy_pct REAL,
  waste_diversion_rate REAL, water_consumption REAL,
  net_zero_target_year TEXT, sustainability_certifications TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

-- Group D: Intelligence
CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS institution_themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  relevance_score INTEGER, evidence TEXT,
  identified_at TEXT DEFAULT (datetime('now')),
  UNIQUE(institution_id, theme_id)
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL, triggered_by TEXT DEFAULT 'user',
  status TEXT DEFAULT 'Running',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT, documents_included TEXT
);

CREATE TABLE IF NOT EXISTS analysis_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_run_id INTEGER NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL, title TEXT NOT NULL, narrative TEXT NOT NULL,
  priority_rank INTEGER, relevant_service_line TEXT, supporting_data TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### File: `src/db/db.ts`

A singleton database module. Export:

```ts
// Initialize sql.js, run SCHEMA_SQL, load from localStorage if available
export async function initDb(): Promise<void>

// Execute a SELECT and return rows as typed objects
export function query<T>(sql: string, params?: BindParams): T[]

// Execute INSERT/UPDATE/DELETE using parameterized queries
export function execute(sql: string, params?: BindParams): void

// Persist current DB state to localStorage as base64 blob
export function saveDb(): void

// Download the current DB as a .db file
export function exportDb(): void

// Replace the current DB with an uploaded .db file
export function importDb(file: File): Promise<void>

// Read a single app_setting by key
export function getSetting(key: string): string | null

// Write an app_setting
export function setSetting(key: string, value: string): void
```

- Use `localStorage.setItem('he_tracker_db', base64string)` for persistence.
- Call `saveDb()` after every write operation.
- For `sql.js`, import the WASM binary from `sql.js/dist/sql-wasm.js` and point `locateFile` at the correct WASM path served by Vite.

---

## App State

### File: `src/context/AppContext.tsx`

Use React Context + `useReducer`. The global state shape:

```ts
interface AppState {
  institutions: Institution[]
  tags: Tag[]
  dbReady: boolean
  toasts: Toast[]
}
```

Actions: `SET_INSTITUTIONS`, `SET_TAGS`, `SET_DB_READY`, `ADD_TOAST`, `REMOVE_TOAST`.

Export `useAppState()` and `useAppDispatch()` hooks.

On `dbReady`, load institutions and tags from SQLite into context.

---

## TypeScript Types

### File: `src/types/index.ts`

Define interfaces matching the database tables:

```ts
interface Institution {
  id: number
  name: string
  short_code: string
  province: string | null
  institution_type: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
  document_count?: number
}

interface Tag {
  id: number
  name: string
  colour: string | null
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}
```

---

## App Shell

### File: `src/App.tsx`

- Calls `initDb()` on mount; renders a full-page loading spinner until `dbReady = true`
- Wraps everything in `AppProvider` and `BrowserRouter`
- Renders `<Layout>` with nested `<Routes>`

Routes:
```
/                     → <Navigate to="/dashboard" />
/dashboard            → <Dashboard />
/institutions         → <Institutions />
/institutions/:id     → <InstitutionDetail />
/documents            → <Documents />
/analysis             → <Analysis />
/settings             → <Settings />
```

### File: `src/components/Layout.tsx`

```
┌─────────────────────────────────────────────────────┐
│  [🎓 HE Tracker]     [Search placeholder]    [⚙]   │  ← fixed header, bg-slate-800, h-14
├──────────────┬──────────────────────────────────────┤
│ 🏠 Dashboard │                                      │
│ 🏛 Instit.   │   <Outlet />                         │
│ 📄 Documents │                                      │
│ 📊 Analysis  │                                      │
│ ⚙  Settings  │                                      │
│              │                                      │
│ ──────────── │                                      │
│ DB: Ready    │                                      │
└──────────────┴──────────────────────────────────────┘
```

- Sidebar width: `w-56`, `bg-slate-800`, white text
- Active nav item: `bg-green-600` pill
- Sidebar collapsible: toggle button at bottom, collapses to icon-only `w-14` on click
- Main content: `flex-1 overflow-auto bg-slate-50 p-6`

---

## Pages & Components

### `src/components/Toast.tsx` + `src/components/ToastContainer.tsx`

- Fixed bottom-right stack of toast notifications
- Auto-dismiss after 4 seconds
- Types: success (green), error (red), info (blue)
- Export `useToast()` hook that dispatches `ADD_TOAST`

### `src/components/StatusBadge.tsx`

```tsx
// <StatusBadge status="Processed" /> → green pill with text
// Props: status: string (maps to colour scheme above)
```

### `src/components/SlideOver.tsx`

Reusable right-side drawer:
- Props: `open: boolean`, `onClose: () => void`, `title: string`, `children`
- Backdrop overlay, slide-in animation from right
- Close button (X icon) in header

### `src/components/ConfirmDialog.tsx`

Modal confirmation dialog:
- Props: `open`, `onConfirm`, `onCancel`, `title`, `message`, `confirmLabel` (default "Delete"), `danger?: boolean`

### `src/pages/Dashboard.tsx`

Stat cards:
- Total Institutions
- Total Documents
- Processed Documents
- Recent Activity (last 5 documents uploaded, showing institution name + filename + status badge)

All data read from SQLite via `query()`.

### `src/pages/Institutions.tsx`

- Top bar: "Institutions" heading + "Add Institution" button (opens slide-over)
- Search input filtering by name/short_code/province
- Grid of institution cards: name (large), short code badge, province, type, tag badges, document count, "View" button
- Empty state if no institutions

### `src/components/InstitutionForm.tsx`

Used inside `<SlideOver>` for add/edit:

Fields:
- Full name (text, required)
- Short code (text, required, auto-suggested: uppercase first letters of name words, editable, uniqueness validated on submit)
- Province (select: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT)
- Institution type (select: University, College, Polytechnic, Institute, Other)
- Website (url input)
- Notes (textarea)
- Tags (multi-select checkboxes from existing tags + inline "Create tag" option that opens a mini form)

On submit: INSERT or UPDATE in SQLite, call `saveDb()`, refresh institutions in context, close slide-over, show success toast.

### `src/pages/InstitutionDetail.tsx`

Route: `/institutions/:id`

- Header: institution name (h1), short code badge, province, type, website link, Edit button, Delete button
- 7 tabs: Overview, Documents, Financials, Strategic Priorities, KPIs, Sustainability, Insights
- In Phase 1, all tabs except Overview show a placeholder: "Data will appear after documents are processed."
- Overview tab shows: stat cards (document count = 0, priorities = 0, insights = 0), empty recent documents list

### `src/pages/Settings.tsx`

Two sections:

**Azure OpenAI Configuration**
- Endpoint URL (text)
- API Key (password input, show/hide toggle)
- Deployment name (text)
- API version (text, default `2024-02-15-preview`)
- "Save Settings" button → writes to `app_settings` via `setSetting()`
- "Test Connection" button → shows "Not implemented yet" toast (Phase 3 will implement)

**Database Management**
- "Export Database" button → calls `exportDb()`
- "Import Database" button → file picker, calls `importDb(file)`
- Last export/import timestamp (stored in `app_settings` as `last_export_at`)

**Tag Management** (inline on this page or sub-section)
- List of all tags with colour swatch, name, delete button
- "Add Tag" inline form: name input + colour picker (6 preset hex colours to pick from)

### `src/pages/Documents.tsx`
Placeholder page: heading "Documents" + "Document processing will be available in Phase 2."

### `src/pages/Analysis.tsx`
Placeholder page: heading "Analysis" + "Cross-institution analysis will be available in Phase 6."

---

## Non-Functional Requirements for Phase 1

- All SQL writes use parameterized queries — **never string interpolation**
- `saveDb()` called after every write
- On DB init failure, show a full-page error state with instructions
- TypeScript strict mode (`"strict": true` in tsconfig)
- No `any` types except where unavoidable with sql.js raw results (cast immediately)

---

## Deliverable

Running `npm run dev` should open the app in the browser with:
1. Sidebar navigation working
2. Dashboard showing 0-count stat cards
3. Institutions page with working add/edit/delete
4. Settings page saving Azure config and managing tags
5. DB export/import working
6. Institution detail showing tabs (empty content)

Commit message: `feat(phase-1): app shell, database layer, institution CRUD, settings`
