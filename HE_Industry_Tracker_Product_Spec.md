# HE Industry Tracker — Product Specification
**Version:** 1.0  
**Date:** May 2026  
**Author:** Chris Fernandes, Consultant, Deloitte Canada GPS  
**Status:** Ready for React Implementation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals & Constraints](#2-goals--constraints)
3. [Tech Stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Data Model (SQLite Schema)](#5-data-model-sqlite-schema)
6. [Feature List](#6-feature-list)
7. [AI Integration](#7-ai-integration)
8. [Screen Inventory & UI Spec](#8-screen-inventory--ui-spec)
9. [AI Prompts Reference](#9-ai-prompts-reference)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Implementation Phases](#11-implementation-phases)

---

## 1. Project Overview

The **HE Industry Tracker** is an internal practice intelligence tool for the Deloitte Canada Government & Public Sector (GPS) Higher Education consulting team. It allows consultants to upload institutional documents (annual reports, financial statements, strategic plans, sustainability reports) from Canadian post-secondary institutions, extract structured intelligence using AI, and view that intelligence through a dashboard.

The React version is a **locally-run web application** — no cloud hosting, no Power Platform dependency. It runs entirely on the consultant's machine, uses a local SQLite database for persistence, reads and parses PDFs in the browser, and calls an Azure OpenAI endpoint for AI-powered extraction and analysis.

### What it replaces

| Old Stack Component | React Replacement |
|---|---|
| Dataverse (13 tables) | SQLite via `sql.js` (browser) or `better-sqlite3` (Node) |
| Power Automate (5 flows) | In-app processing pipeline |
| AI Builder / GPT-4o | Azure OpenAI API (direct fetch) |
| Model-driven Power App | React SPA with sidebar navigation |

---

## 2. Goals & Constraints

### Goals
- Allow any GPS Higher Ed consultant to add a Canadian institution and upload documents for it
- Automatically extract structured data (financials, strategic priorities, KPIs, sustainability metrics) from PDFs using AI
- Generate consulting opportunity insights based on extracted data
- Provide a clean dashboard to browse intelligence by institution
- Run entirely offline / locally with no internet dependency except for AI calls

### Hard Constraints
- **No backend server.** The app runs as a React SPA opened locally (via `npm run dev` or a static file server).
- **Local database only.** Persistence via SQLite stored as a `.db` file on the local machine. Use `sql.js` for browser-based SQLite, or `better-sqlite3` if running in Electron or a Node server context. Default: `sql.js` with file export/import for persistence.
- **No auth.** This is a single-user local tool. No login screen required.
- **AI calls via Azure OpenAI.** The app must be configurable with an Azure OpenAI endpoint URL and API key via a settings screen. No hardcoded keys.
- **PDF parsing in-browser.** Use `pdfjs-dist` (Mozilla PDF.js) to extract text from uploaded PDFs. No server-side PDF processing.
- **No external state management libraries.** Use React Context + `useReducer` for global state. Keep the dependency list lean.

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 + Vite | Fast dev server, simple build, no SSR needed |
| Language | TypeScript | Type safety for complex data model |
| Styling | Tailwind CSS v3 | Utility-first, consistent design system |
| Database | `sql.js` (SQLite compiled to WASM) | True SQLite in the browser, zero server |
| DB persistence | `localStorage` (serialized DB blob) or `.db` file download/upload | Survives page refresh |
| PDF parsing | `pdfjs-dist` | Industry standard, browser-native |
| AI | Azure OpenAI REST API (fetch) | Uses existing Deloitte Azure tenant |
| Icons | `lucide-react` | Lightweight, consistent icon set |
| Charts | `recharts` | Composable charts for financial data |
| Routing | `react-router-dom` v6 | SPA routing with sidebar nav |
| Markdown rendering | `react-markdown` | Render AI narrative outputs |

### Package.json dependencies (key packages)
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.22.0",
    "sql.js": "^1.10.3",
    "pdfjs-dist": "^4.0.379",
    "recharts": "^2.12.0",
    "lucide-react": "^0.383.0",
    "react-markdown": "^9.0.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@types/react": "^18.3.0",
    "typescript": "^5.3.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

> **Note on `sql.js`:** It uses a WASM binary. In `vite.config.ts`, you must configure the WASM asset to be served correctly:  
> `optimizeDeps: { exclude: ['sql.js'] }` and `server: { headers: { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' } }`

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                React SPA (local, Vite dev server)         │
│                                                           │
│  ┌───────────────┐   ┌────────────────┐   ┌───────────┐  │
│  │  Sidebar Nav  │   │  Page Views    │   │  Settings │  │
│  │  - Dashboard  │   │  (react-router)│   │  Panel    │  │
│  │  - Institutions│  │                │   │           │  │
│  │  - Documents  │   └────────────────┘   └───────────┘  │
│  │  - Analysis   │                                        │
│  └───────────────┘                                        │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │  App State (React Context + useReducer)            │   │
│  │  - institutions, documents, facts, financials,     │   │
│  │    priorities, insights, processingQueue           │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  ┌───────────────────┐   ┌───────────────────────────┐   │
│  │  DB Layer          │   │  Processing Pipeline       │   │
│  │  sql.js (SQLite)   │   │  1. PDF → text chunks     │   │
│  │  Persisted via     │   │  2. Classify document      │   │
│  │  localStorage blob │   │  3. Extract structured     │   │
│  └───────────────────┘   │     data (AI call)          │   │
│                           │  4. Write to SQLite        │   │
│                           │  5. Generate insights      │   │
│                           └───────────────────────────┘   │
└───────────────────────────────────┬──────────────────────┘
                                    │ HTTPS fetch
                                    ▼
                    ┌──────────────────────────┐
                    │  Azure OpenAI Endpoint    │
                    │  (Deloitte tenant)        │
                    │  GPT-4o deployment        │
                    └──────────────────────────┘
```

### Processing Pipeline (replaces Power Automate)

When a user uploads a PDF, the app runs a sequential in-browser pipeline:

```
Upload PDF
  → Parse text with pdfjs-dist (full text extraction)
  → Chunk text into ~3,000 token segments with overlap
  → AI Call 1: Classify document
      (returns: documentType, institutionName, confidence)
  → Confirm or override classification (user prompt)
  → AI Call 2: Extract structured data
      (returns JSON: financials OR priorities OR facts, based on doc type)
  → Write extracted rows to SQLite
  → AI Call 3: Generate consulting insights
      (reads all data for this institution, returns narrative insights)
  → Write insights to SQLite
  → Update document status to "Processed"
```

Each step updates a visible status indicator so the user can see progress.

---

## 5. Data Model (SQLite Schema)

All tables follow the original 13-table Dataverse model, simplified for SQLite.

### Group A — Core

```sql
CREATE TABLE institutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  short_code TEXT UNIQUE NOT NULL,          -- e.g. "UVIC", "UOT"
  province TEXT,
  institution_type TEXT,                    -- "University", "College", "Polytechnic"
  website TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  colour TEXT                               -- hex colour for badge display
);

CREATE TABLE institution_tags (
  institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (institution_id, tag_id)
);
```

### Group B — Document Ingestion

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  document_type TEXT,                       -- "Financial Statement", "Strategic Plan", "Sustainability Report", "Annual Report", "Other"
  fiscal_year TEXT,                         -- e.g. "2024"
  upload_date TEXT DEFAULT (datetime('now')),
  processing_status TEXT DEFAULT 'Pending', -- "Pending", "Processing", "Processed", "Failed"
  processing_error TEXT,
  page_count INTEGER,
  word_count INTEGER,
  raw_text TEXT                             -- full extracted text from pdfjs-dist
);

CREATE TABLE document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_estimate INTEGER
);
```

### Group C — Structured Data

```sql
CREATE TABLE financial_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  fiscal_year TEXT NOT NULL,
  total_revenue REAL,
  total_expenses REAL,
  net_surplus_deficit REAL,
  operating_revenue REAL,
  operating_expenses REAL,
  government_grants REAL,
  tuition_revenue REAL,
  research_revenue REAL,
  investment_income REAL,
  total_assets REAL,
  total_liabilities REAL,
  net_assets REAL,
  endowment_value REAL,
  international_student_revenue REAL,
  notes TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE strategic_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  plan_name TEXT,
  plan_period_start TEXT,                   -- e.g. "2022"
  plan_period_end TEXT,                     -- e.g. "2027"
  vision_statement TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE strategic_priorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  strategic_plan_id INTEGER REFERENCES strategic_plans(id),
  document_id INTEGER REFERENCES documents(id),
  priority_name TEXT NOT NULL,
  priority_description TEXT,
  pillar TEXT,                              -- overarching theme/pillar
  progress_status TEXT,                     -- "On Track", "At Risk", "Achieved", "Unknown"
  key_initiatives TEXT,                     -- JSON array of strings
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE kpi_datapoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  kpi_name TEXT NOT NULL,
  kpi_category TEXT,                        -- "Enrolment", "Research", "Financial", "Student Success", "Indigenous", "Sustainability"
  fiscal_year TEXT,
  value REAL,
  unit TEXT,                                -- "students", "%", "$", "papers", etc.
  notes TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sustainability_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  fiscal_year TEXT,
  ghg_emissions_total REAL,                 -- tCO2e
  ghg_scope_1 REAL,
  ghg_scope_2 REAL,
  ghg_scope_3 REAL,
  energy_consumption REAL,                  -- GJ
  renewable_energy_pct REAL,
  waste_diversion_rate REAL,
  water_consumption REAL,                   -- m3
  net_zero_target_year TEXT,
  sustainability_certifications TEXT,       -- JSON array
  extracted_at TEXT DEFAULT (datetime('now'))
);
```

### Group D — Intelligence

```sql
CREATE TABLE themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,               -- "Indigenization", "Digital Transformation", "Financial Sustainability", etc.
  description TEXT,
  is_system INTEGER DEFAULT 0              -- 1 = built-in theme, 0 = user-created
);

CREATE TABLE institution_themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  relevance_score INTEGER,                 -- 1–5
  evidence TEXT,
  identified_at TEXT DEFAULT (datetime('now')),
  UNIQUE(institution_id, theme_id)
);

CREATE TABLE analysis_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL,                  -- "FullAnalysis", "QuickInsights", "PriorityReview"
  triggered_by TEXT DEFAULT 'user',
  status TEXT DEFAULT 'Running',           -- "Running", "Complete", "Failed"
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  documents_included TEXT                  -- JSON array of document IDs used
);

CREATE TABLE analysis_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_run_id INTEGER NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,              -- "ConsultingOpportunity", "Risk", "Trend", "Strength", "Weakness"
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,                 -- full AI-generated markdown narrative
  priority_rank INTEGER,                   -- 1 (highest) to 5
  relevant_service_line TEXT,             -- "Technology", "Finance", "Strategy", "People & Change"
  supporting_data TEXT,                    -- JSON: references to specific rows in other tables
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Settings Table

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- Keys used:
-- azure_openai_endpoint   (e.g. https://xxx.openai.azure.com/)
-- azure_openai_api_key
-- azure_openai_deployment (e.g. gpt-4o)
-- azure_openai_api_version (e.g. 2024-02-15-preview)
-- app_version
-- db_created_at
```

---

## 6. Feature List

Features are organized into modules. Each module maps to a section of the UI.

---

### Module 1: App Shell & Navigation

**F-001 — Sidebar navigation**
Persistent left sidebar with links to: Dashboard, Institutions, Documents, Analysis, Settings. Shows active route highlight. Collapsible on narrow screens.

**F-002 — Database initialization**
On first load, the app creates the SQLite schema in memory and checks `localStorage` for a saved DB blob. If found, it loads from the blob. If not, it creates a fresh DB and prompts the user to set up their Azure OpenAI credentials.

**F-003 — DB export / import**
Settings screen has "Export Database" (downloads a `.db` file) and "Import Database" (uploads a `.db` file to replace the current DB). This is the persistence / backup mechanism.

**F-004 — Azure OpenAI settings**
Settings screen with a form for:
- Endpoint URL
- API Key (masked input)
- Deployment name
- API version
"Test Connection" button that sends a trivial completion request to validate credentials. Shows success/error status.

---

### Module 2: Institutions

**F-010 — Institution list view**
A searchable, filterable list of all institutions. Each card shows: name, short code, province, institution type, number of documents, last document upload date, and tags. Clicking opens the institution detail view.

**F-011 — Add / Edit institution**
Slide-over panel (not a page change) with a form:
- Full name (required)
- Short code (required, auto-suggested from name, must be unique)
- Province (dropdown: all Canadian provinces/territories)
- Institution type (dropdown: University, College, Polytechnic, Institute, Other)
- Website URL
- Notes (textarea)
- Tags (multi-select from existing tags, with inline create)

**F-012 — Delete institution**
Confirmation dialog. Cascades to delete all related documents, facts, financials, priorities, insights.

**F-013 — Institution detail view**
A tabbed layout. The institution name and metadata appear in a header. Tabs:
- Overview (summary cards: latest financials, number of strategic priorities, insight count)
- Documents (list of all uploaded documents for this institution)
- Financials (financial data table + chart, across years)
- Strategic Priorities (list of priorities with status)
- KPIs (table of extracted KPI datapoints)
- Sustainability (sustainability metrics display)
- Insights (analysis findings cards for this institution)

**F-014 — Tag management**
Simple CRUD screen under Settings for managing tags. Each tag has a name and a badge colour.

---

### Module 3: Document Ingestion

**F-020 — Upload document**
Accessible from the institution detail view (Documents tab) or the top-level Documents list. A file picker that accepts `.pdf` files only. Multiple files can be queued.

**F-021 — PDF text extraction**
After upload, the app uses `pdfjs-dist` to extract all text from the PDF synchronously in the browser. Extracted text is stored in the `documents.raw_text` column. Page count and word count are also computed and stored.

**F-022 — Document chunking**
The extracted raw text is split into chunks of approximately 3,000 tokens (≈12,000 characters) with a 200-character overlap between chunks. Chunks are stored in `document_chunks`.

**F-023 — AI Classification**
After chunking, the app sends the first two chunks to the Azure OpenAI endpoint with the classification prompt (see Section 9). Returns: `documentType`, `fiscalYear`, `institutionName` (for validation), `confidence` (0–1). This result is shown to the user for confirmation before proceeding.

**F-024 — User confirmation step**
A modal showing the AI's classification result. User can accept or override `documentType` and `fiscalYear` before extraction begins.

**F-025 — AI Extraction**
After confirmation, the app sends chunks to the Azure OpenAI endpoint with the appropriate extraction prompt based on `documentType`:
- Financial Statement → Financial extraction prompt
- Strategic Plan → Strategic priorities extraction prompt
- Sustainability Report → Sustainability metrics extraction prompt
- Annual Report → Run all three prompts sequentially
- Other → Facts extraction prompt (generic key facts)

Each prompt returns a JSON object. The app parses this and writes rows to the appropriate SQLite tables.

**F-026 — Processing status indicator**
A persistent status bar (visible on the Documents page and as a global notification) shows the current pipeline step for any in-progress document: "Extracting text", "Classifying...", "Awaiting confirmation", "Extracting financials...", "Writing to database", "Generating insights...", "Complete" or "Failed".

**F-027 — Manual re-processing**
On any document that has `processing_status = "Failed"` or `"Processed"`, a "Re-process" button is available. This re-runs the full extraction pipeline using the stored raw text (no re-upload needed).

**F-028 — Document list view (global)**
A top-level Documents page showing all documents across all institutions. Columns: institution name, filename, document type, fiscal year, upload date, status. Filterable by institution, document type, status. Clickable rows open the document detail panel.

**F-029 — Document detail panel**
A slide-over showing: metadata, processing log, extracted data preview (condensed), and a "View Raw Text" toggle.

---

### Module 4: Data Views

**F-030 — Financial dashboard (per institution)**
Under the Financials tab of an institution. Shows:
- A multi-year bar/line chart of: Total Revenue, Total Expenses, Net Surplus/Deficit
- A breakdown chart for the most recent year: Revenue sources (tuition, government grants, research, investment, international students, other)
- A data table of all `financial_summaries` rows, sortable by year
- Year-over-year change indicators (% change from prior year)

**F-031 — Strategic priorities list (per institution)**
Under the Strategic Priorities tab. Shows a card-based list grouped by `pillar`. Each card: priority name, description, progress status (coloured badge), key initiatives (bulleted list). Filterable by status and pillar.

**F-032 — KPI table (per institution)**
Under the KPIs tab. A filterable table grouped by `kpi_category`. Shows: KPI name, value, unit, year, source document.

**F-033 — Sustainability panel (per institution)**
Under the Sustainability tab. Shows GHG emissions trend chart and a data table for all years. Also shows net zero target year and certifications.

**F-034 — Cross-institution comparison view**
A dedicated comparison page (accessible from the Institutions list). User selects 2–4 institutions and a metric category (Financial, Enrolment, Sustainability). Renders a side-by-side bar chart and table for the selected metric.

---

### Module 5: AI Analysis

**F-040 — Run Full Analysis**
Available on any institution detail view. Triggers AI Call 3 (see Section 9 — Consulting Insights prompt). Reads all data for the institution from SQLite, constructs a prompt, calls Azure OpenAI, and writes the response as one or more `analysis_findings` rows. Creates a corresponding `analysis_runs` record.

**F-041 — Analysis findings display**
Under the Insights tab of an institution. Cards for each `analysis_finding`, grouped by `finding_type`. Each card shows: title, narrative (rendered markdown), priority rank (star indicator), and relevant service line badge. Cards are sorted by priority rank.

**F-042 — Analysis run history**
A table showing past `analysis_runs` for an institution: date, type, status, number of findings generated. Clicking a row shows the findings from that run.

**F-043 — Quick Insights (single document)**
Available from the document detail panel for any processed document. Runs a focused analysis only on data extracted from that specific document. Useful for rapid single-doc insights without a full analysis run.

**F-044 — Themes tagging**
After a full analysis, the app automatically proposes theme tags for the institution based on the findings. User confirms or dismisses. Confirmed themes are written to `institution_themes`.

**F-045 — Cross-institution themes view**
A page (under Analysis in the nav) showing all themes and which institutions have been tagged with each theme. Clicking a theme shows all institutions tagged with it and a count of findings referencing it.

---

### Module 6: Search

**F-050 — Global search**
A search bar in the app header. Searches across: institution names, document filenames, strategic priority names, finding titles, and finding narratives. Results shown in a dropdown with grouped categories. Clicking a result navigates to the relevant page.

---

## 7. AI Integration

### Azure OpenAI Configuration

All AI calls use the Azure OpenAI Chat Completions API:

```
POST https://{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api-version}
Headers:
  api-key: {api_key}
  Content-Type: application/json
Body:
  { "messages": [...], "temperature": 0.1, "max_tokens": 4096, "response_format": { "type": "json_object" } }
```

For narrative (non-JSON) outputs (consulting insights), omit `response_format` and use `temperature: 0.4`.

### Error handling for AI calls

- Wrap every AI call in try/catch
- On network error or non-200 response: set `processing_status = "Failed"`, store error in `processing_error` column, show toast notification
- On JSON parse failure: retry once with a "return only valid JSON" suffix appended to the prompt; if still failing, mark as failed
- On rate limit (429): wait 10 seconds and retry up to 3 times

### Token management

The full raw text of a financial statement can be 40,000+ characters. The app must chunk appropriately:
- Classification: send only chunks 0 and 1 (first ~6,000 chars)
- Extraction: send chunks sequentially if the document is long; merge partial JSON results using a merge strategy (see prompts section)
- For documents >8 chunks: send in batches of 3 chunks; collect partial extraction JSON arrays; merge by deduplication on key field names

---

## 8. Screen Inventory & UI Spec

### Layout

```
┌────────────────────────────────────────────────────────────────┐
│  [Logo: HE Tracker]   [Global Search Bar]         [Settings ⚙] │  ← Header (fixed)
├──────────────────┬─────────────────────────────────────────────┤
│  🏠 Dashboard    │                                              │
│  🏛 Institutions │         Main Content Area                    │
│  📄 Documents    │         (route-driven)                       │
│  📊 Analysis     │                                              │
│  ⚙  Settings    │                                              │
│                  │                                              │
│  ─────────────  │                                              │
│  [DB Status]     │                                              │
│  [AI Status]     │                                              │
└──────────────────┴─────────────────────────────────────────────┘
```

### Color System (Tailwind config)

Use a professional, subdued palette suitable for a consulting tool:

```
Primary:     slate-800 (dark navy)
Accent:      green-600 (Deloitte green family)
Surface:     white / slate-50
Border:      slate-200
Text:        slate-900 (headings), slate-600 (body), slate-400 (muted)
Status colours:
  - Processed:   green-100 / green-700
  - Processing:  blue-100 / blue-700
  - Pending:     yellow-100 / yellow-700
  - Failed:      red-100 / red-700
  - On Track:    green badge
  - At Risk:     orange badge
  - Achieved:    blue badge
  - Unknown:     slate badge
```

### Typography

- Headings: `font-semibold`, `tracking-tight`
- Body: `text-sm` for data-dense views, `text-base` for narrative text
- Monospace: only for raw text views

### Key UI Patterns

- **Slide-over panels** for add/edit forms (not page navigation). Use a right-side drawer pattern.
- **Toast notifications** for async operation results (success, error, info).
- **Skeleton loaders** during AI processing steps.
- **Confirmation dialogs** for destructive actions (delete institution, re-process document).
- **Status badges** (small coloured pill components) used consistently everywhere status is displayed.
- **Progress steps** during document processing: a linear stepper showing the current pipeline step.

### Route Map

```
/                         → redirect to /dashboard
/dashboard                → Dashboard (overview cards, recent activity)
/institutions             → Institution list
/institutions/new         → (opens slide-over, not a page)
/institutions/:id         → Institution detail (tabbed)
/institutions/:id/compare → (future: comparison modal trigger)
/documents                → Global document list
/documents/:id            → (slide-over from list)
/analysis                 → Analysis hub (themes map, cross-institution)
/settings                 → Settings (Azure config, DB export/import, tags)
```

---

## 9. AI Prompts Reference

All prompts share a **persona block** prepended at the start:

```
You are a higher education sector analyst specializing in Canadian post-secondary institutions. Your role is to extract structured data from institutional documents and identify strategic patterns, financial trends, and intelligence valuable to a management consulting team at Deloitte Canada.

Always output valid JSON only, with no preamble, explanation, or markdown fences. The JSON must be parseable by JSON.parse() with no modifications.
```

---

### Prompt 1 — Document Classification

**When used:** After chunking, before extraction (F-023).  
**Input:** First 2 chunks of document text.

**System message:** Persona block (above).  
**User message:**
```
Classify the following document excerpt from a Canadian post-secondary institution.

Return a JSON object with exactly these fields:
{
  "documentType": one of "Financial Statement", "Strategic Plan", "Sustainability Report", "Annual Report", "Other",
  "fiscalYear": "YYYY" or null if not found,
  "institutionName": the full institution name as it appears in the document, or null,
  "confidence": a number between 0 and 1 indicating your confidence in the classification
}

Document text:
---
{CHUNK_0_TEXT}
{CHUNK_1_TEXT}
---
```

---

### Prompt 2A — Financial Extraction

**When used:** For documents classified as "Financial Statement" or the financial component of "Annual Report" (F-025).  
**Input:** All chunks of the document (sent sequentially; merge results).

**User message:**
```
Extract financial data from the following text of a Canadian post-secondary institution's financial statement.

Return a JSON object with exactly these fields (use null for any value not found in the text):
{
  "fiscalYear": "YYYY",
  "totalRevenue": number | null,
  "totalExpenses": number | null,
  "netSurplusDeficit": number | null,
  "operatingRevenue": number | null,
  "operatingExpenses": number | null,
  "governmentGrants": number | null,
  "tuitionRevenue": number | null,
  "researchRevenue": number | null,
  "investmentIncome": number | null,
  "totalAssets": number | null,
  "totalLiabilities": number | null,
  "netAssets": number | null,
  "endowmentValue": number | null,
  "internationalStudentRevenue": number | null,
  "notes": "any important caveats or clarifications about the numbers"
}

All monetary values must be in Canadian dollars. If values appear in thousands, convert to full dollars. Do not include commas.

Document text (chunk {CHUNK_INDEX} of {TOTAL_CHUNKS}):
---
{CHUNK_TEXT}
---
```

---

### Prompt 2B — Strategic Priorities Extraction

**When used:** For documents classified as "Strategic Plan" or the strategic component of "Annual Report" (F-025).

**User message:**
```
Extract strategic priorities from the following text of a Canadian post-secondary institution's strategic plan.

Return a JSON object with exactly this structure:
{
  "planName": "name of the strategic plan" | null,
  "planPeriodStart": "YYYY" | null,
  "planPeriodEnd": "YYYY" | null,
  "visionStatement": "the institution's vision statement" | null,
  "priorities": [
    {
      "priorityName": "name of the priority",
      "priorityDescription": "one to three sentence description",
      "pillar": "overarching theme or pillar this belongs to" | null,
      "progressStatus": one of "On Track", "At Risk", "Achieved", "Unknown",
      "keyInitiatives": ["initiative 1", "initiative 2", "..."]
    }
  ]
}

Extract all priorities, goals, or strategic directions mentioned. Return an empty array for "priorities" if none are found.

Document text (chunk {CHUNK_INDEX} of {TOTAL_CHUNKS}):
---
{CHUNK_TEXT}
---
```

---

### Prompt 2C — Sustainability Extraction

**When used:** For documents classified as "Sustainability Report" (F-025).

**User message:**
```
Extract sustainability and environmental data from the following text of a Canadian post-secondary institution's sustainability report.

Return a JSON object with exactly these fields (null for anything not found):
{
  "fiscalYear": "YYYY" | null,
  "ghgEmissionsTotal": number | null,
  "ghgScope1": number | null,
  "ghgScope2": number | null,
  "ghgScope3": number | null,
  "emissionsUnit": "tCO2e" or other unit if specified,
  "energyConsumption": number | null,
  "energyUnit": "GJ" or other unit if specified,
  "renewableEnergyPct": number | null,
  "wasteDiversionRate": number | null,
  "waterConsumption": number | null,
  "netZeroTargetYear": "YYYY" | null,
  "sustainabilityCertifications": ["cert 1", "cert 2"],
  "notes": "any important caveats"
}

Document text (chunk {CHUNK_INDEX} of {TOTAL_CHUNKS}):
---
{CHUNK_TEXT}
---
```

---

### Prompt 2D — Generic Key Facts Extraction

**When used:** For documents classified as "Other" (F-025).

**User message:**
```
Extract key facts and data points from the following institutional document text. Focus on facts relevant to a consulting firm that advises Canadian post-secondary institutions.

Return a JSON object:
{
  "facts": [
    {
      "kpiName": "descriptive name for this data point",
      "kpiCategory": one of "Enrolment", "Research", "Financial", "Student Success", "Indigenous", "Sustainability", "Other",
      "value": number | null,
      "unit": "unit of measure" | null,
      "fiscalYear": "YYYY" | null,
      "notes": "context or clarification" | null
    }
  ]
}

Extract up to 25 of the most strategically relevant facts.

Document text (chunk {CHUNK_INDEX} of {TOTAL_CHUNKS}):
---
{CHUNK_TEXT}
---
```

---

### Prompt 3 — Consulting Insights Generation

**When used:** After extraction completes, or when user clicks "Run Full Analysis" (F-040).  
**Input:** Compiled summary of all extracted data for the institution (constructed by the app, not raw text).  
**Response format:** Plain text markdown (not JSON).

**User message:**
```
You are a senior consultant at Deloitte Canada advising the Government & Public Sector Higher Education practice. Based on the following intelligence data for {INSTITUTION_NAME}, identify the most actionable consulting opportunities for Deloitte.

Institution data:
---
{COMPILED_DATA_SUMMARY}
---

The compiled data above includes: financial trend data across years, strategic priorities, KPI datapoints, and sustainability metrics.

Generate a structured analysis with the following sections:

## Top Consulting Opportunities
List 3–5 specific, actionable consulting opportunities. For each, include:
- A concise title
- A 2–3 sentence description of the opportunity
- Why this is timely based on the data
- Which Deloitte service line is best positioned (Technology, Finance, Strategy, or People & Change)
- Priority ranking (1 = highest)

## Key Risks & Challenges
List 2–3 risks the institution faces based on the data.

## Financial Health Summary
A 3–5 sentence narrative on the institution's financial trajectory.

## Strategic Alignment Themes
Identify 2–4 recurring strategic themes visible across the institution's priorities and data.

Be specific to this institution. Do not use generic language. Reference specific data points from the compiled data where possible.
```

---

## 10. Non-Functional Requirements

### Performance
- PDF text extraction must complete within 10 seconds for a 100-page document
- SQLite reads must return within 100ms for all standard queries
- AI calls may take 5–30 seconds — always show a spinner/progress indicator
- The app must not freeze the UI during AI calls (use async/await with proper state management)

### Data Integrity
- All SQLite writes must use parameterized queries (no string interpolation — SQL injection risk even locally)
- Before writing extracted data, validate that required fields (institution_id, fiscal_year for financials) are present
- Show a warning if an AI extraction returns unexpected JSON shape

### Portability
- The entire app must run from `npm run dev` with no additional infrastructure
- The SQLite database must be exportable as a single `.db` file and importable on another machine
- The app must run on macOS, Windows, and Linux

### Accessibility
- All interactive elements must have visible focus states
- Color is never the sole differentiator (always pair colour status badges with a text label)
- All form inputs must have labels

---

## 11. Implementation Phases

Build in this order. Each phase should result in a working, testable slice of the app.

### Phase 1 — Skeleton & Database (no AI)
- Vite + React + TypeScript + Tailwind setup
- `sql.js` integration with schema initialization and localStorage persistence
- App shell: sidebar nav, header, routing
- Settings screen: Azure OpenAI credentials form (save to `app_settings`), DB export/import
- Basic institution CRUD: list view, add/edit slide-over, delete confirmation
- Institution detail view shell (tabs visible, content empty)

### Phase 2 — Document Ingestion (no AI)
- PDF upload interface
- `pdfjs-dist` text extraction
- Document chunking logic
- Document record written to SQLite with `processing_status = "Pending"`
- Global documents list view
- Document detail slide-over

### Phase 3 — AI Classification & Extraction
- Azure OpenAI fetch utility with error handling and retry logic
- Document classification call + user confirmation modal
- Financial extraction prompt + SQLite write
- Strategic priorities extraction prompt + SQLite write
- Sustainability extraction prompt + SQLite write
- Generic facts extraction prompt + SQLite write
- Processing pipeline status indicator

### Phase 4 — Data Views
- Financial dashboard tab (charts + table) using `recharts`
- Strategic priorities tab
- KPIs tab
- Sustainability tab
- Dashboard home screen (overview cards: institution count, document count, recent activity)

### Phase 5 — AI Analysis & Insights
- Consulting insights prompt
- `analysis_runs` + `analysis_findings` write
- Insights tab (findings cards)
- Run Full Analysis button
- Quick Insights button on document panel

### Phase 6 — Polish & Advanced Features
- Cross-institution comparison view
- Themes tagging
- Cross-institution themes view
- Global search
- Tag management
- Year-over-year change indicators in financial view

---

*End of Specification*
