# Database Structure

The app uses **sql.js** — SQLite compiled to WebAssembly — running entirely in the browser. There is no backend server. The database is serialised as a base64 blob and persisted to `localStorage` on every write. It can be exported as a `.db` file and re-imported from Settings.

The schema is defined in [`src/db/schema.ts`](../src/db/schema.ts) as a single `SCHEMA_SQL` string executed on first load. All tables use `CREATE TABLE IF NOT EXISTS`, so the schema is safe to run on an existing database.

All database writes use parameterised queries (never string interpolation) via `execute()` in `src/db/db.ts`, followed by `saveDb()` to persist the updated blob.

---

## Entity Relationship Overview

```
institutions
  ├── institution_tags ──── tags
  ├── documents
  │     └── document_chunks
  ├── financial_summaries
  ├── strategic_plans
  │     └── strategic_priorities
  ├── kpi_datapoints
  ├── sustainability_metrics
  ├── analysis_runs
  │     └── analysis_findings
  └── institution_themes ── themes

app_settings  (standalone key/value store)
```

---

## Tables

### `institutions`
The central entity. Every other table links back to this via `institution_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT NOT NULL | Full institution name |
| `short_code` | TEXT UNIQUE NOT NULL | e.g. `UBC`, `UOFT` |
| `province` | TEXT | e.g. `BC`, `ON` |
| `institution_type` | TEXT | e.g. `University`, `College` |
| `website` | TEXT | |
| `notes` | TEXT | Free-form notes |
| `created_at` | TEXT | ISO datetime, default `now` |
| `updated_at` | TEXT | ISO datetime, default `now` |

---

### `tags`
User-defined labels that can be applied to institutions.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT UNIQUE NOT NULL | |
| `colour` | TEXT | Hex colour string, e.g. `#16a34a` |

### `institution_tags`
Many-to-many join between institutions and tags. Cascade deletes on both sides.

| Column | Type | Notes |
|---|---|---|
| `institution_id` | INTEGER | FK → institutions(id) ON DELETE CASCADE |
| `tag_id` | INTEGER | FK → tags(id) ON DELETE CASCADE |

Composite primary key: `(institution_id, tag_id)`.

---

### `documents`
One row per uploaded PDF. Tracks the full pipeline lifecycle.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `filename` | TEXT NOT NULL | Original filename |
| `document_type` | TEXT | `Financial Statement`, `Strategic Plan`, `Sustainability Report`, `Annual Report`, `Other` |
| `fiscal_year` | TEXT | e.g. `2023` |
| `upload_date` | TEXT | ISO datetime, default `now` |
| `processing_status` | TEXT | `Pending` → `processed` or `failed` |
| `processing_error` | TEXT | Error message if status is `failed` |
| `page_count` | INTEGER | Extracted by pdfjs-dist |
| `word_count` | INTEGER | Extracted by pdfjs-dist |
| `raw_text` | TEXT | Full extracted text (not used for queries, kept for reference) |

### `document_chunks`
The extracted text split into overlapping chunks for AI processing (~12,000 chars each, 200-char overlap).

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `document_id` | INTEGER NOT NULL | FK → documents(id) ON DELETE CASCADE |
| `chunk_index` | INTEGER NOT NULL | 0-based position |
| `chunk_text` | TEXT NOT NULL | Chunk content |
| `token_estimate` | INTEGER | Approximate token count |

---

### `financial_summaries`
One row per institution per fiscal year. Populated by the AI financial extraction pipeline.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `document_id` | INTEGER | FK → documents(id), nullable |
| `fiscal_year` | TEXT NOT NULL | e.g. `2023` |
| `total_revenue` | REAL | |
| `total_expenses` | REAL | |
| `net_surplus_deficit` | REAL | Positive = surplus, negative = deficit |
| `operating_revenue` | REAL | |
| `operating_expenses` | REAL | |
| `government_grants` | REAL | |
| `tuition_revenue` | REAL | |
| `research_revenue` | REAL | |
| `investment_income` | REAL | |
| `total_assets` | REAL | |
| `total_liabilities` | REAL | |
| `net_assets` | REAL | |
| `endowment_value` | REAL | |
| `international_student_revenue` | REAL | |
| `notes` | TEXT | Extraction notes |
| `extracted_at` | TEXT | ISO datetime, default `now` |

---

### `strategic_plans`
Top-level metadata for a strategic plan document.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `document_id` | INTEGER | FK → documents(id), nullable |
| `plan_name` | TEXT | e.g. `Strategic Plan 2023–2028` |
| `plan_period_start` | TEXT | e.g. `2023` |
| `plan_period_end` | TEXT | e.g. `2028` |
| `vision_statement` | TEXT | Extracted vision/mission statement |
| `extracted_at` | TEXT | ISO datetime, default `now` |

### `strategic_priorities`
Individual priorities extracted from a strategic plan. Each priority belongs to one plan.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `strategic_plan_id` | INTEGER | FK → strategic_plans(id), nullable |
| `document_id` | INTEGER | FK → documents(id), nullable |
| `priority_name` | TEXT NOT NULL | |
| `priority_description` | TEXT | |
| `pillar` | TEXT | Grouping pillar/theme within the plan |
| `progress_status` | TEXT | `On Track`, `At Risk`, `Achieved`, `Unknown` |
| `key_initiatives` | TEXT | JSON array of initiative strings |
| `extracted_at` | TEXT | ISO datetime, default `now` |

---

### `kpi_datapoints`
Generic numeric KPIs extracted from any document type.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `document_id` | INTEGER | FK → documents(id), nullable |
| `kpi_name` | TEXT NOT NULL | e.g. `Total Enrolment` |
| `kpi_category` | TEXT | e.g. `Enrolment`, `Research`, `Financial` |
| `fiscal_year` | TEXT | |
| `value` | REAL | |
| `unit` | TEXT | e.g. `students`, `$M`, `%` |
| `notes` | TEXT | |
| `extracted_at` | TEXT | ISO datetime, default `now` |

---

### `sustainability_metrics`
Environmental and sustainability data, one row per institution per fiscal year.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `document_id` | INTEGER | FK → documents(id), nullable |
| `fiscal_year` | TEXT | |
| `ghg_emissions_total` | REAL | tCO2e |
| `ghg_scope_1` | REAL | tCO2e — direct emissions |
| `ghg_scope_2` | REAL | tCO2e — purchased energy |
| `ghg_scope_3` | REAL | tCO2e — value chain |
| `energy_consumption` | REAL | |
| `renewable_energy_pct` | REAL | 0–100 |
| `waste_diversion_rate` | REAL | 0–100 |
| `water_consumption` | REAL | |
| `net_zero_target_year` | TEXT | e.g. `2050` |
| `sustainability_certifications` | TEXT | Comma-separated or JSON list |
| `extracted_at` | TEXT | ISO datetime, default `now` |

---

### `analysis_runs`
Tracks each AI analysis job triggered by the user.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `run_type` | TEXT NOT NULL | `FullAnalysis` or `QuickInsights` |
| `triggered_by` | TEXT | `user` (default) |
| `status` | TEXT | `Running` → `Complete` or `Failed` |
| `started_at` | TEXT | ISO datetime, default `now` |
| `completed_at` | TEXT | ISO datetime, nullable |
| `documents_included` | TEXT | JSON array of document IDs, nullable |

### `analysis_findings`
Individual findings produced by an analysis run.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `analysis_run_id` | INTEGER NOT NULL | FK → analysis_runs(id) ON DELETE CASCADE |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `finding_type` | TEXT NOT NULL | `ConsultingOpportunity`, `Risk`, `Strength`, `Weakness`, `Trend` |
| `title` | TEXT NOT NULL | Short finding headline |
| `narrative` | TEXT NOT NULL | Full markdown narrative |
| `priority_rank` | INTEGER | 1 = highest priority (ConsultingOpportunity only) |
| `relevant_service_line` | TEXT | e.g. `Technology Advisory`, `Financial Advisory`, `Strategy`, `People & Change`, `Risk Advisory` |
| `created_at` | TEXT | ISO datetime, default `now` |

---

### `themes`
Strategic theme taxonomy. Nine system themes are pre-seeded at schema initialisation.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT UNIQUE NOT NULL | |
| `description` | TEXT | |
| `is_system` | INTEGER | `1` for pre-seeded themes, `0` for user-created |

**Pre-seeded system themes:** Indigenization, Digital Transformation, Financial Sustainability, Research Excellence, Student Success, Sustainability & Climate, Enrolment Management, Internationalization, People & Culture.

### `institution_themes`
Many-to-many join between institutions and themes, with relevance scoring.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `institution_id` | INTEGER NOT NULL | FK → institutions(id) ON DELETE CASCADE |
| `theme_id` | INTEGER NOT NULL | FK → themes(id) ON DELETE CASCADE |
| `relevance_score` | INTEGER | 1–5 |
| `evidence` | TEXT | Excerpt from findings supporting the tag |
| `identified_at` | TEXT | ISO datetime, default `now` |

Unique constraint on `(institution_id, theme_id)`.

---

### `app_settings`
Simple key/value store for application configuration.

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | Setting name |
| `value` | TEXT | Setting value |

**Keys in use:**
- `azure_openai_endpoint` — Azure OpenAI resource URL
- `azure_openai_api_key` — API key (stored in localStorage, not transmitted server-side)
- `azure_openai_deployment` — Deployment name, e.g. `gpt-4o`
- `azure_openai_api_version` — e.g. `2024-02-15-preview`
- `last_export_at` — ISO datetime of last DB export

---

## Implementation Files

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Single source of truth — `SCHEMA_SQL` string |
| `src/db/db.ts` | sql.js singleton, `query()`, `execute()`, `saveDb()`, `exportDb()`, `importDb()`, `getSetting()`, `setSetting()` |
| `src/db/documentDb.ts` | CRUD for `documents` and `document_chunks` |
| `src/db/extractionDb.ts` | Writes for `financial_summaries`, `strategic_plans`, `strategic_priorities`, `sustainability_metrics`, `kpi_datapoints` |
| `src/db/analysisDb.ts` | CRUD for `analysis_runs` and `analysis_findings` |
| `src/db/seedData.ts` | Inserts sample data for UBC and UToronto (Settings → Developer Tools) |
