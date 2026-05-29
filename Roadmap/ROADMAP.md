# HE Industry Tracker — Implementation Roadmap

This file is the master checklist. Each phase has its own PRP (Product Requirements Prompt) file that contains everything Claude needs to implement that phase. Complete phases in order — each phase builds on the last.

---

## Phase 1 — Skeleton & Database
**File:** `PRP_Phase1_Skeleton_and_Database.md`

- [ ] Vite + React 18 + TypeScript + Tailwind CSS v3 project scaffolded
- [ ] `vite.config.ts` configured for `sql.js` WASM (COOP/COEP headers, optimizeDeps exclude)
- [ ] `sql.js` integrated — schema initialized on first load, persisted to `localStorage` as binary blob
- [ ] All 13 SQLite tables created (see schema in spec)
- [ ] App shell: fixed header with logo + global search placeholder, collapsible left sidebar, main content area
- [ ] React Router v6 routes wired: `/`, `/dashboard`, `/institutions`, `/documents`, `/analysis`, `/settings`
- [ ] Settings screen: Azure OpenAI config form (endpoint, API key masked, deployment, API version), save to `app_settings` table, "Test Connection" button stub
- [ ] DB export (download `.db` file) and DB import (upload `.db` file) working
- [ ] Institution list view (`/institutions`): searchable card list showing name, short code, province, type, tag badges
- [ ] Add / Edit institution: slide-over panel with full form (name, short code, province dropdown, type dropdown, website, notes, tags multi-select)
- [ ] Delete institution: confirmation dialog with cascade warning
- [ ] Institution detail view shell (`/institutions/:id`): header with name/metadata, 7 tabs visible (Overview, Documents, Financials, Strategic Priorities, KPIs, Sustainability, Insights), tab content empty/placeholder
- [ ] Toast notification system (success, error, info)
- [ ] Tag management page under Settings (create, rename, delete tags with colour picker)
- [ ] Dashboard page (`/dashboard`): stat cards for institution count, document count, placeholder for recent activity

---

## Phase 2 — Document Ingestion (no AI)
**File:** `PRP_Phase2_Document_Ingestion.md`

- [ ] PDF file picker on institution Documents tab (`.pdf` only, multiple files)
- [ ] `pdfjs-dist` text extraction — full text, page count, word count written to `documents` table
- [ ] Document chunking: ~3,000 tokens (~12,000 chars) per chunk, 200-char overlap, chunks written to `document_chunks`
- [ ] Document record created in SQLite with `processing_status = "Pending"` on upload
- [ ] Processing status indicator UI: linear stepper showing current pipeline step per document
- [ ] Global documents list (`/documents`): all docs across institutions, columns for institution, filename, type, fiscal year, upload date, status badge; filterable by institution / type / status
- [ ] Document detail slide-over: metadata, processing log, extracted data preview placeholder, "View Raw Text" toggle

---

## Phase 3 — AI Classification & Extraction
**File:** `PRP_Phase3_AI_Pipeline.md`

- [ ] Azure OpenAI fetch utility (`src/services/aiService.ts`): handles auth headers, retries on 429 (3×, 10s wait), retries JSON parse failure once, sets `processing_status = "Failed"` on unrecoverable error
- [ ] Document classification call (Prompt 1): sends chunks 0+1, returns `documentType`, `fiscalYear`, `institutionName`, `confidence`
- [ ] User confirmation modal: shows classification result, allows override of `documentType` and `fiscalYear` before extraction
- [ ] Financial extraction (Prompt 2A): sequential chunk processing, writes to `financial_summaries`
- [ ] Strategic priorities extraction (Prompt 2B): writes to `strategic_plans` + `strategic_priorities`
- [ ] Sustainability extraction (Prompt 2C): writes to `sustainability_metrics`
- [ ] Generic key facts extraction (Prompt 2D): writes to `kpi_datapoints`
- [ ] Annual Report routing: runs financial + strategic + sustainability prompts sequentially
- [ ] Processing pipeline status bar updates live through all steps
- [ ] Manual re-process button on failed/processed documents
- [ ] "Test Connection" button on Settings now functional (sends trivial completion request)

---

## Phase 4 — Data Views
**File:** `PRP_Phase4_Data_Views.md`

- [ ] Financial tab (per institution): multi-year bar/line chart (Revenue, Expenses, Net Surplus) using Recharts; revenue breakdown donut chart for most recent year; sortable data table; year-over-year % change indicators
- [ ] Strategic Priorities tab: card list grouped by pillar, progress status badge, key initiatives bulleted list, filter by status/pillar
- [ ] KPIs tab: filterable table grouped by `kpi_category`, shows KPI name, value, unit, year, source document
- [ ] Sustainability tab: GHG trend line chart, data table across years, net zero target year, certifications list
- [ ] Institution Overview tab: summary cards (latest revenue/expenses, priorities count, insights count, document count), recent documents list
- [ ] Dashboard home: institution count, document count, processed doc count, recent activity feed

---

## Phase 4.1 — Seed Data for UI Preview
**File:** `PRP_Phase4.1_Seed_Data.md`

- [ ] `src/db/seedData.ts` inserts 2 institutions (UBC, UToronto), 3 documents, multi-year financials, strategic plans/priorities, KPIs, sustainability metrics
- [ ] "Load Sample Data" button in Settings → Developer Tools section
- [ ] Confirm dialog warns existing data is not affected (seed is additive)
- [ ] Loading twice shows graceful error toast

---

## Phase 5 — AI Analysis & Insights
**File:** `PRP_Phase5_AI_Analysis.md`

- [ ] Consulting insights prompt (Prompt 3): compiles all institution data into summary string, calls Azure OpenAI, parses markdown response into structured `analysis_findings` rows
- [ ] `analysis_runs` record created on each run (status: Running → Complete/Failed)
- [ ] Insights tab (per institution): findings cards grouped by `finding_type`, rendered markdown narrative, priority rank stars, service line badge, sorted by rank
- [ ] "Run Full Analysis" button on institution detail header
- [ ] Analysis run history table: past runs with date, type, status, findings count; click to view findings from that run
- [ ] "Quick Insights" button on document detail panel: runs focused single-doc analysis
- [ ] Theme auto-proposal after full analysis: proposed themes shown in a confirmation UI; confirmed themes written to `institution_themes`

---

## Phase 6 — Polish & Advanced Features
**File:** `PRP_Phase6_Polish_and_Advanced.md`

- [ ] Cross-institution comparison view: select 2–4 institutions + metric category, renders side-by-side bar chart + table
- [ ] Cross-institution themes view (`/analysis`): all themes listed, institutions tagged per theme, click-through to theme detail
- [ ] Global search: header search bar, searches institution names, document filenames, priority names, finding titles + narratives, grouped dropdown results with navigation
- [ ] Year-over-year change indicators in financial view (% delta from prior year, coloured up/down arrows)
- [ ] Accessibility pass: all inputs labelled, focus states visible, status badges always include text label
- [ ] Final polish: skeleton loaders during all async ops, consistent toast usage, responsive sidebar collapse on narrow screens

---

*Each PRP file is a self-contained prompt. Feed it to Claude along with the existing codebase to implement that phase.*
