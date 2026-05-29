# PRP — Phase 5: AI Analysis & Insights

## Context

Phases 1–4 are complete. The app has full data views for financials, priorities, KPIs, and sustainability. The database contains extracted structured data.

This is **Phase 5**. Add the consulting insights AI pipeline: compile institution data into a summary, call Azure OpenAI, parse the response into structured findings, and display them as cards. Also add theme auto-proposal and the analysis run history.

---

## Consulting Insights Prompt (Prompt 3)

**System message:** same persona block as Phase 3.

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

This prompt uses `temperature: 0.4` and does **not** use `jsonMode: true` — it returns a plain markdown string.

---

## Data Compiler

### File: `src/services/insightsCompiler.ts`

```ts
export function compileInstitutionData(institutionId: number): string
```

Reads all available data for the institution from SQLite and formats it as a readable text summary:

```
INSTITUTION: {name} ({short_code})
Province: {province} | Type: {institution_type}

=== FINANCIAL DATA ===
{For each financial_summaries row, sorted by fiscal_year:}
FY{year}: Revenue $X.XM | Expenses $X.XM | Surplus/Deficit $X.XM | Assets $X.XM

=== STRATEGIC PRIORITIES ===
Plan: {plan_name} ({start}–{end})
Vision: {vision_statement}
{For each strategic_priority:}
- [{pillar}] {priority_name} ({progress_status})
  {priority_description}
  Initiatives: {key_initiatives joined with '; '}

=== KPI DATAPOINTS ===
{For each kpi_datapoint, grouped by category:}
[{category}] {kpi_name}: {value} {unit} (FY{fiscal_year})

=== SUSTAINABILITY ===
{For most recent sustainability_metrics row:}
GHG Total: {value} tCO₂e (Scope 1: X, Scope 2: X, Scope 3: X)
Net Zero Target: {year or "Not set"}
Certifications: {list}
```

Cap the total string at ~8,000 characters to stay within token limits. If it exceeds this, truncate the KPI section first, then sustainability details.

---

## Insights AI Service

### Add to `src/services/aiService.ts`

```ts
export async function generateInsights(
  institutionName: string,
  compiledData: string
): Promise<string>  // returns raw markdown
```

Uses the Prompt 3 template with `temperature: 0.4`, no `jsonMode`. Returns the full markdown string.

---

## Insights Parser

### File: `src/services/insightsParser.ts`

Parse the markdown narrative returned by Prompt 3 into structured `analysis_findings` rows.

```ts
interface ParsedFinding {
  finding_type: 'ConsultingOpportunity' | 'Risk' | 'Strength' | 'Trend' | 'Weakness'
  title: string
  narrative: string
  priority_rank: number | null
  relevant_service_line: string | null
}

export function parseInsightsMarkdown(markdown: string): ParsedFinding[]
```

Parsing strategy:
- Split on `## ` section headings
- `## Top Consulting Opportunities` → parse each numbered item; extract title (first line or bold line), the rest as narrative; infer service line from "Technology / Finance / Strategy / People & Change" if mentioned; priority_rank from order (1 = first)
- `## Key Risks & Challenges` → each bullet → `finding_type: 'Risk'`, no priority_rank
- `## Financial Health Summary` → single finding, `finding_type: 'Strength'` or `'Weakness'` based on sentiment (if text contains "deficit", "declining", "concern" → Weakness; else Strength)
- `## Strategic Alignment Themes` → each theme → `finding_type: 'Trend'`

If parsing fails or produces 0 findings: create a single finding with `finding_type: 'Trend'`, `title: 'Full Analysis'`, `narrative: markdownString` (store the whole thing).

---

## Analysis DB Writes

### File: `src/db/analysisDb.ts`

```ts
// Create an analysis_runs record, return its id
export function createAnalysisRun(institutionId: number, runType: string, documentIds?: number[]): number

// Update analysis_runs status
export function updateAnalysisRunStatus(
  runId: number,
  status: 'Complete' | 'Failed',
  completedAt: string
): void

// Write analysis_findings rows
export function saveFindings(runId: number, institutionId: number, findings: ParsedFinding[]): void

// Get all analysis_runs for an institution, most recent first
export function getAnalysisRuns(institutionId: number): AnalysisRunRow[]

// Get all findings for a specific run
export function getFindingsByRun(runId: number): FindingRow[]

// Get all findings for an institution (latest run)
export function getLatestFindings(institutionId: number): FindingRow[]
```

Types:
```ts
interface AnalysisRunRow {
  id: number
  institution_id: number
  run_type: string
  status: string
  started_at: string
  completed_at: string | null
  finding_count?: number  // joined count
}

interface FindingRow {
  id: number
  analysis_run_id: number
  finding_type: string
  title: string
  narrative: string
  priority_rank: number | null
  relevant_service_line: string | null
}
```

---

## Full Analysis Pipeline

### File: `src/services/analysisPipeline.ts`

```ts
export async function runFullAnalysis(
  institutionId: number,
  institutionName: string,
  onStatus: (msg: string) => void
): Promise<void>
```

Steps:
1. `onStatus('Compiling institution data...')`
2. `compileInstitutionData(institutionId)` → `compiledData`
3. `createAnalysisRun(institutionId, 'FullAnalysis')` → `runId`
4. `onStatus('Calling Azure OpenAI...')`
5. `generateInsights(institutionName, compiledData)` → `markdown`
6. `onStatus('Parsing findings...')`
7. `parseInsightsMarkdown(markdown)` → `findings`
8. `saveFindings(runId, institutionId, findings)`
9. `updateAnalysisRunStatus(runId, 'Complete', datetime())`
10. `saveDb()`
11. `onStatus('Analysis complete')`

On error: `updateAnalysisRunStatus(runId, 'Failed', datetime())`, rethrow.

---

## Quick Insights Pipeline

### File: `src/services/analysisPipeline.ts` (add)

```ts
export async function runQuickInsights(
  documentId: number,
  institutionId: number,
  institutionName: string,
  onStatus: (msg: string) => void
): Promise<void>
```

Same as full analysis but:
- `compileInstitutionData` is replaced with a single-document summary (just the data extracted from that document)
- `run_type = 'QuickInsights'`
- `documents_included = JSON.stringify([documentId])`

---

## Themes Auto-Proposal

### File: `src/services/themesService.ts`

After a full analysis completes, scan the findings narratives for known theme keywords and propose them.

Built-in themes to seed (insert on first DB init if `is_system = 1`):
```
Indigenization, Digital Transformation, Financial Sustainability,
Research Excellence, Student Success, Sustainability & Climate,
Enrolment Management, Internationalization, People & Culture
```

```ts
// Propose themes based on finding narratives
export function proposeThemes(
  institutionId: number,
  findings: FindingRow[]
): ProposedTheme[]

interface ProposedTheme {
  themeId: number
  themeName: string
  evidence: string  // excerpt from finding that triggered this
  relevanceScore: number  // 1–5
}
```

Match by simple keyword scan of `finding.narrative + finding.title` against each theme name and its synonyms (e.g., "Indigenization" matches "indigenous", "decolonization", "reconciliation").

---

## Theme Confirmation UI

### File: `src/components/ThemeProposalModal.tsx`

Props: `proposedThemes: ProposedTheme[]`, `onConfirm: (accepted: ProposedTheme[]) => void`, `onCancel: () => void`

UI:
- Modal title: "Proposed Strategic Themes"
- Subtitle: "Based on the analysis findings, the following themes were identified. Select the ones to apply to this institution."
- List of proposed themes, each with a checkbox (pre-checked), theme name, evidence excerpt
- "Apply Selected Themes" button → writes accepted themes to `institution_themes` table
- "Skip" link

---

## Updated Institution Detail

### Institution header bar — add "Run Full Analysis" button

```tsx
// Positioned in the institution detail header alongside Edit/Delete
<button onClick={handleRunAnalysis} disabled={isAnalysing}>
  {isAnalysing ? <Spinner /> : <BarChart2 size={16} />}
  {isAnalysing ? statusMsg : 'Run Full Analysis'}
</button>
```

After analysis completes, show `<ThemeProposalModal>` with proposed themes.

### Insights Tab

**File:** `src/pages/tabs/InsightsTab.tsx`

**Run history table** (top section):

Columns: Run Date, Type, Status (badge), Findings Count, Actions (View)

Click a run row → filters the findings cards below to show that run's findings.

**Findings cards** (main section):

Grouped by `finding_type`: ConsultingOpportunity, Risk, Trend, Strength, Weakness.

Each card:
```
┌────────────────────────────────────────────────┐
│ [Priority stars ★★★☆☆]  [Service Line badge]  │
│ Title (font-semibold, text-slate-900)           │
│                                                  │
│ <ReactMarkdown>{narrative}</ReactMarkdown>       │
└────────────────────────────────────────────────┘
```

- Priority rank 1 = 5 stars, rank 5 = 1 star, null = no stars shown
- Service line badge colours: Technology (blue), Finance (green), Strategy (purple), People & Change (orange)
- Finding type group headings: "Consulting Opportunities" (green), "Risks & Challenges" (red), "Trends" (blue), "Strengths" (emerald), "Weaknesses" (orange)

**Empty state:** "No analysis has been run yet. Click 'Run Full Analysis' to generate consulting insights."

---

## Document Detail Panel — Quick Insights

Add to `DocumentDetailPanel.tsx`:
- "Quick Insights" button (only shown when `processing_status = 'Processed'`)
- Shows a small status label while running
- On completion: shows success toast "Quick insights generated — view in the Insights tab"

---

## Install react-markdown

```bash
npm install react-markdown
```

Import: `import ReactMarkdown from 'react-markdown'`

Apply prose styling to markdown output:
```tsx
<div className="prose prose-sm max-w-none text-slate-700">
  <ReactMarkdown>{finding.narrative}</ReactMarkdown>
</div>
```

Install `@tailwindcss/typography` for prose classes:
```bash
npm install @tailwindcss/typography
```
Add to `tailwind.config.js` plugins: `require('@tailwindcss/typography')`.

---

## Deliverable

After Phase 5:
1. "Run Full Analysis" button on institution detail generates and displays findings
2. Insights tab shows finding cards grouped by type, with markdown narrative rendered
3. Analysis run history table shows past runs
4. "Quick Insights" on document detail panel works
5. After full analysis, theme proposal modal appears; confirmed themes written to DB

Commit message: `feat(phase-5): AI consulting insights pipeline, findings display, theme auto-proposal`
