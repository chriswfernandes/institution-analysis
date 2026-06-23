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

## Phase 7 — Manual Data Entry
**File:** `PRP_Phase7_Manual_Data_Entry.md`

*Enables full use of the app without an LLM API key. All four extracted-data tabs gain inline Add / Edit / Delete capability so users can enter and correct data by hand.*

- [ ] `src/db/extractionDb.ts`: add `upsertFinancialSummary()`, `upsertStrategicPriority()`, `upsertKpiDatapoint()`, `upsertSustainabilityMetric()` and matching delete functions
- [ ] Financials tab: `+ Add Entry` button opens slide-over form; pencil/trash icons on each YoY table row
- [ ] Strategic Priorities tab: `+ Add Priority` button; edit/delete on each priority card
- [ ] KPIs tab: `+ Add KPI` button; delete on each row
- [ ] Sustainability tab: `+ Add Year` button; edit/delete on each data table row
- [ ] All forms reuse `SlideOver` + `ConfirmDialog`; persist via `execute()` + `saveDb()`

---

## Phase 8 — CSV Export
**File:** `PRP_Phase8_CSV_Export.md`

*Enables users to pull data into Excel/PowerPoint for client deliverables without needing the binary `.db` file.*

- [ ] `src/utils/exportCsv.ts`: shared `downloadCsv(filename, rows)` utility using Blob + URL.createObjectURL
- [ ] "Export CSV" button on Financial tab → `{short_code}_financials.csv`
- [ ] "Export CSV" button on KPIs tab (respects active filters) → `{short_code}_kpis.csv`
- [ ] "Export CSV" button on Strategic Priorities tab → `{short_code}_priorities.csv`
- [ ] "Export CSV" button on Sustainability tab → `{short_code}_sustainability.csv`
- [ ] "Export CSV" button on Insights tab (current run) → `{short_code}_insights_{run_id}.csv`
- [ ] "Export CSV" button on Institutions list → `institutions.csv`
- [ ] "Export CSV" button on Comparison view → `comparison_{metric}_{date}.csv`
- [ ] Error toast when table has no data to export

---

## Phase 8.1 — Institution Detail Tab Bar Scrollability
**File:** `PRP_Phase8.1_Tab_Bar_Scrollability.md`

*The 7-tab bar on Institution Detail clips on screens narrower than ~1100px, making Financials, KPIs, Strategic Priorities, and Sustainability unreachable.*

- [ ] Outer div holds `border-b` (static, never clipped); inner div holds `overflow-x-auto -mb-px`
- [ ] Each tab button gets `shrink-0` to prevent compression
- [ ] Active-tab green underline remains flush with the border at all widths
- [ ] `.scrollbar-hide` utility added to `src/index.css` if not already present
- [ ] Verified at 768px: all 7 tabs scrollable and selectable

---

## Phase 8.2 — Sample Data Backfill
**File:** `PRP_Phase8.2_Sample_Data_Backfill.md`

*Users whose localStorage database pre-dates Phase 4.1 have UBC/U of T institutions but no financial, KPI, priority, or sustainability rows. The seed guard blocks a re-run. This phase adds an auto-backfill on startup and a Settings "Reset to Sample Data" escape hatch.*

- [ ] `backfillSeedData()` in `seedData.ts` — checks COUNT per table per institution, inserts only missing rows
- [ ] `clearAndReseed()` in `seedData.ts` — deletes all data tables, then runs `seedDatabase()`
- [ ] `db.ts` calls `backfillSeedData()` after `initSchema()` on every page load (no-op if data present)
- [ ] Settings page: "Reset to Sample Data" danger zone with ConfirmDialog → `clearAndReseed()` → toast + navigate

---

## Phase 9 — Bulk Institution Import
**File:** `PRP_Phase9_Bulk_Import.md`

*Allows users to load many institutions at once from a CSV spreadsheet instead of entering each one via the form.*

- [ ] Settings → new "Bulk Import" section with "Download CSV Template" and "Import Institutions from CSV" buttons
- [ ] CSV template downloads with headers: `name, short_code, province, institution_type, website, notes`
- [ ] CSV parser handles quoted fields, missing optional columns, blank lines
- [ ] Validation: required `name` + `short_code` fields; skip duplicate short codes
- [ ] Result toast: "N imported, M skipped (short codes: ...)"
- [ ] Imported institutions immediately appear in the Institutions page (global context refreshed)

---

## Phase 10 — Error Boundary & Print Report
**File:** `PRP_Phase10_Error_Boundary_and_Print.md`

*Two hardening items: crash recovery so the app never goes fully blank, and a print stylesheet for shareable institution reports.*

- [ ] `src/components/ErrorBoundary.tsx`: class component with fallback UI and "Reload page" button; wraps `<Outlet />` in Layout
- [ ] Institution detail: all tab panels rendered in DOM simultaneously, inactive ones hidden via CSS (`hidden print:block`)
- [ ] `src/index.css`: `@media print` block hides sidebar/header/nav, shows all tab panels, fixes Recharts SVG sizing
- [ ] "Print Report" button added to institution header (calls `window.print()`; hidden in print output)

---

## Phase 11 — Document Type Registry
**File:** `PRP_Phase11_Document_Type_Registry.md`

*Replaces hardcoded if/else extraction routing with a config-driven registry of 8 document types. Fixes the gap where Annual Reports never populated kpi_datapoints. Adds Enrolment Report and Budget Submission as first-class types.*

- [ ] `src/services/documentTypeRegistry.ts`: registry with 8 types, each declaring extractors[] and keyFactsHint
- [ ] `processingPipeline.ts`: reads from registry instead of if/else blocks
- [ ] `aiService.ts`: `extractKeyFacts()` accepts optional `hint` param injected into prompt
- [ ] `ClassificationConfirmModal`: dropdown populated from registry; shows "Will populate: ..." for selected type
- [ ] `ClassificationResult.documentType` widened to `string` in types

---

## Phase 12 — Re-process Guard
**File:** `PRP_Phase12_Reprocess_Guard.md`

*Makes extraction writes idempotent: re-processing a document replaces existing rows rather than duplicating them. Adds a low-confidence warning banner in the classification confirmation modal.*

- [ ] `extractionDb.ts`: all four save functions DELETE existing rows for document_id before INSERT
- [ ] `processingPipeline.ts`: attaches `lowConfidence: true` when `confidence < 0.6`
- [ ] `ClassificationResult` type: add `lowConfidence?: boolean`
- [ ] `ClassificationConfirmModal`: amber warning banner when `lowConfidence` is true
- [ ] `DocumentDetailPanel.tsx`: re-process confirm message updated to mention data replacement

---

## Phase 13 — Extraction Review UI
**File:** `PRP_Phase13_Extraction_Review_UI.md`

*Adds an "Extracted Data" panel inside the Document Detail slide-over showing every row the pipeline wrote, with per-row delete and a "Clear All Extractions" bulk action.*

- [ ] `DocumentDetailPanel.tsx`: collapsible "Extracted Data" section queries all four extraction tables by document_id
- [ ] Per-row ✕ delete with toast; reloads summary after each delete
- [ ] "Clear All Extractions" button with ConfirmDialog
- [ ] `extractionDb.ts`: new `clearExtractionsForDocument(documentId)` helper
- [ ] Section only shown when `processing_status === 'processed'`

---

## Phase 14 — LiteLLM Provider Support
**File:** `PRP_Phase14_LiteLLM_Provider.md`

*Adds a LiteLLM (OpenAI-compatible) provider alongside the existing direct-Azure path, so the app can send prompts through a LiteLLM proxy (e.g. the Polaris stack). The proxy holds the real provider keys; the client only needs a base URL, bearer token, and model name. Azure remains the default — no existing behavior changes unless the user opts in.*

- [ ] New `app_settings` keys: `ai_provider` (`azure` | `litellm`), `litellm_base_url`, `litellm_api_key`, `litellm_model` (no schema change)
- [ ] `aiService.ts`: add `getProvider()` + `getLiteLLMConfig()`; replace `callAzureOpenAI()` with provider-agnostic `callLLM()` (Bearer auth + `model` in body for LiteLLM, `api-key` header for Azure)
- [ ] `aiService.ts`: migrate all call sites and fold `generateInsights()` into `callLLM()`
- [ ] `Settings.tsx`: provider dropdown + conditional LiteLLM fields (Base URL, API Key, Model Name); load/save new keys; existing "Test Connection" routes through `callLLM()`
- [ ] `docs/DATABASE.md`: document the four new `app_settings` keys

---

## Phase 15 — Docling Document Conversion
**File:** `PRP_Phase15_Docling_Ingestion.md`

*Replaces the in-browser pdfjs text extraction with a Docling Serve conversion-to-Markdown step. Any uploaded file (PDF, Word, PowerPoint, Excel, HTML, images) is converted to Markdown — tables preserved — then chunked and fed to the existing AI extraction pipeline. Docling runs as a separate service the app reaches via a configurable endpoint; it is required for all uploads (no pdfjs fallback).*

- [ ] New `src/services/doclingService.ts`: `convertToMarkdown()` (`POST {endpoint}/v1/convert/file`, reads `document.md_content`), `chunkText()`/`ChunkInput` carried over from pdfService, `testDoclingConnection()`
- [ ] New `app_settings` key `docling_endpoint` (no schema change); documented in `docs/DATABASE.md`
- [ ] `Settings.tsx`: "Document Conversion (Docling)" section with endpoint field + Test Connection
- [ ] Retire pdfjs: delete `pdfService.ts`, remove `pdfjs-dist` from `package.json` and worker config; update `documentDb.ts` import
- [ ] `ProcessingContext.tsx` + `ProcessingStatusBar.tsx`: add a `converting` step ("Converting with Docling…")
- [ ] `DocumentUpload.tsx`: broaden accepted file types + `accept`; call `convertToMarkdown()`; store markdown in `raw_text` (page_count 0); updated drop-zone copy

---

## Phase 16 — Markdown-Aware Extraction & Setup Hardening
**File:** `PRP_Phase16_Markdown_Extraction_Tables.md`

*Tunes the AI extraction to exploit Docling's Markdown tables, confirms the broadened file set routes to the right extractors, hardens the conversion call for slow/large files, and documents how to run Docling Serve (incl. CORS) so the browser SPA can reach it. No schema changes; no change to extraction JSON contracts.*

- [ ] `aiService.ts`: add a shared `MARKDOWN_NOTE` preamble and inject it into the four extraction prompts (financials, sustainability, key facts, strategic)
- [ ] Verify `documentTypeRegistry.ts` + `ClassificationConfirmModal` route new input formats correctly; extend only if a gap is found
- [ ] `doclingService.ts`: timeout/abort with friendly errors; document the async endpoint (`/v1/convert/source/async` + poll) as the upgrade path
- [ ] New `docs/DOCLING.md`: running `docling-serve` (port 5001), enabling CORS for `http://localhost:5173`, pointing the app at it
- [ ] Verification matrix across PDF, DOCX, PPTX, XLSX, HTML, and image inputs

---

## Phase 17 — Auto-start Docling Serve with the Dev Server
**File:** `PRP_Phase17_Dev_Autostart_Docling.md`

*Makes `npm run dev` start Docling Serve automatically alongside Vite, so a single command brings up everything needed for uploads. Uses `concurrently` plus a small Node launcher that runs the Docling container (Docker/Podman). Degrades gracefully — if no container runtime is available, Vite still starts.*

- [ ] `package.json`: add `concurrently`; split `dev` into `dev` + `dev:app` + `dev:docling`; add `docling:stop`
- [ ] New `scripts/start-docling.mjs`: runtime detection (docker/podman), reuse-if-already-running, CORS/UI env flags, signal cleanup, `--stop` mode
- [ ] `docs/DOCLING.md`: note that `npm run dev` auto-starts Docling; prerequisites (Docker/Podman, first-run image pull)
- [ ] Graceful fallback: missing container runtime never takes down Vite; `npm run dev:app` runs the frontend only

---

*Each PRP file is a self-contained prompt. Feed it to Claude along with the existing codebase to implement that phase.*
