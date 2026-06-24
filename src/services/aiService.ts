import { getSetting } from '../db/db'
import { addLog } from '../db/logDb'
import type {
  ChunkRow,
  ClassificationResult,
  FinancialExtraction,
  StrategicExtraction,
  SustainabilityExtraction,
  KeyFactsExtraction,
  KeyFact,
  StrategicPriority,
} from '../types'

const SYSTEM_PROMPT = `You are a higher education sector analyst specializing in Canadian post-secondary institutions. Your role is to extract structured data from institutional documents and identify strategic patterns, financial trends, and intelligence valuable to a management consulting team at Deloitte Canada.

Always output valid JSON only, with no preamble, explanation, or markdown fences. The JSON must be parseable by JSON.parse() with no modifications.`

const MARKDOWN_NOTE = `The document text below is in Markdown produced by Docling. Tables are represented as Markdown pipe tables (rows separated by newlines, cells by "|") — read them column-by-column and align each value with its row and column header. Headings (#) mark sections.`

function getProvider(): 'azure' | 'litellm' {
  return getSetting('ai_provider') === 'litellm' ? 'litellm' : 'azure'
}

function getAzureConfig(): {
  endpoint: string
  apiKey: string
  deployment: string
  apiVersion: string
} {
  const endpoint = getSetting('azure_openai_endpoint')
  const apiKey = getSetting('azure_openai_api_key')
  const deployment = getSetting('azure_openai_deployment')
  const apiVersion = getSetting('azure_openai_api_version')

  if (!endpoint) throw new Error('Please configure Azure OpenAI endpoint in Settings before processing.')
  if (!apiKey) throw new Error('Please configure Azure OpenAI API key in Settings before processing.')
  if (!deployment) throw new Error('Please configure Azure OpenAI deployment name in Settings before processing.')

  return { endpoint, apiKey, deployment, apiVersion: apiVersion ?? '2024-02-15-preview' }
}

function getLiteLLMConfig(): { baseUrl: string; apiKey: string; model: string } {
  const baseUrl = getSetting('litellm_base_url')
  const apiKey = getSetting('litellm_api_key')
  const model = getSetting('litellm_model')

  if (!baseUrl) throw new Error('Please configure the LiteLLM Base URL in Settings before processing.')
  if (!apiKey) throw new Error('Please configure the LiteLLM API key in Settings before processing.')
  if (!model) throw new Error('Please configure the LiteLLM model name in Settings before processing.')

  return { baseUrl, apiKey, model }
}

interface LLMMeta {
  purpose?: string
  documentId?: number | null
  documentName?: string | null
}

async function callLLM(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { jsonMode?: boolean; temperature?: number; maxTokens?: number; meta?: LLMMeta }
): Promise<string> {
  let url: string
  let headers: Record<string, string>
  const provider = getProvider()
  let model: string
  const body: Record<string, unknown> = {
    messages,
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 4096,
  }
  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  if (provider === 'litellm') {
    const cfg = getLiteLLMConfig()
    url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
    headers = { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' }
    body.model = cfg.model
    model = cfg.model
  } else {
    const { endpoint, apiKey, deployment, apiVersion } = getAzureConfig()
    url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
    headers = { 'api-key': apiKey, 'Content-Type': 'application/json' }
    model = deployment
  }

  const meta = options?.meta
  const logBase = {
    category: 'llm' as const,
    provider,
    model,
    purpose: meta?.purpose ?? null,
    documentId: meta?.documentId ?? null,
    documentName: meta?.documentName ?? null,
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 10000))
    const started = performance.now()
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const durationMs = Math.round(performance.now() - started)
      if (resp.status === 429) {
        addLog({ ...logBase, level: 'warn', message: `${meta?.purpose ?? 'completion'} rate limited (429), retrying`, statusCode: 429, durationMs })
        lastError = new Error('Rate limited (429). Retrying…')
        continue
      }
      if (!resp.ok) {
        // HTTP error: log once and fail fast (preserves original non-retry behavior).
        addLog({ ...logBase, level: 'error', message: `LLM error ${resp.status} ${resp.statusText}`, statusCode: resp.status, durationMs })
        throw new Error(`LLM error: ${resp.status} ${resp.statusText}`)
      }
      const data = await resp.json() as { choices: { message: { content: string } }[] }
      addLog({ ...logBase, level: 'info', message: `${meta?.purpose ?? 'completion'} ok`, statusCode: 200, durationMs })
      return data.choices[0].message.content
    } catch (e) {
      const durationMs = Math.round(performance.now() - started)
      const err = e instanceof Error ? e : new Error(String(e))
      // The HTTP-error branch above already logged; rethrow it without retrying.
      if (err.message.startsWith('LLM error:')) throw err
      // Network/abort failure: retry, logging only once on the final attempt.
      lastError = err
      if (attempt === 3) {
        addLog({ ...logBase, level: 'error', message: `LLM request failed: ${err.message}`, durationMs, detail: err.stack ?? null })
      }
    }
  }
  throw lastError ?? new Error('LLM request failed after retries')
}

async function parseJsonWithRetry<T>(
  raw: string,
  retryFn: () => Promise<string>
): Promise<T> {
  try {
    return JSON.parse(raw) as T
  } catch {
    const retried = await retryFn()
    return JSON.parse(retried) as T
  }
}

// ---- Exported pipeline functions ----

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await callLLM([
      { role: 'system', content: 'Reply with exactly: ok' },
      { role: 'user', content: 'ping' },
    ], { maxTokens: 10, meta: { purpose: 'test' } })
    return { success: true, message: 'Connection successful' }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export async function classifyDocument(chunks: ChunkRow[]): Promise<ClassificationResult> {
  const text0 = chunks[0]?.chunk_text ?? ''
  const text1 = chunks[1]?.chunk_text ?? ''
  const userMsg = `Classify the following document excerpt from a Canadian post-secondary institution.

Return a JSON object with exactly these fields:
{
  "documentType": one of "Financial Statement", "Strategic Plan", "Sustainability Report", "Annual Report", "Other",
  "fiscalYear": "YYYY" or null if not found,
  "institutionName": the full institution name as it appears in the document, or null,
  "confidence": a number between 0 and 1 indicating your confidence in the classification
}

Document text:
---
${text0}
${text1}
---`

  const raw = await callLLM(
    [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
    { jsonMode: true, meta: { purpose: 'classify' } }
  )
  return parseJsonWithRetry<ClassificationResult>(raw, () =>
    callLLM(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' },
      ],
      { jsonMode: true, meta: { purpose: 'classify' } }
    )
  )
}

export async function extractFinancials(chunks: ChunkRow[]): Promise<FinancialExtraction> {
  const BATCH = 3
  const results: FinancialExtraction[] = []
  const batches = chunks.length > 8
    ? Array.from({ length: Math.ceil(chunks.length / BATCH) }, (_, i) =>
        chunks.slice(i * BATCH, i * BATCH + BATCH)
      )
    : chunks.map((c) => [c])

  for (const batch of batches) {
    for (const chunk of batch) {
      const userMsg = `${MARKDOWN_NOTE}

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

Document text (chunk ${chunk.chunk_index + 1} of ${chunks.length}):
---
${chunk.chunk_text}
---`

      const raw = await callLLM(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
        { jsonMode: true, meta: { purpose: 'financials' } }
      )
      const parsed = await parseJsonWithRetry<FinancialExtraction>(raw, () =>
        callLLM(
          [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' }],
          { jsonMode: true, meta: { purpose: 'financials' } }
        )
      )
      results.push(parsed)
    }
  }

  return mergeFirstNonNull(results) as FinancialExtraction
}

export async function extractStrategicPriorities(chunks: ChunkRow[]): Promise<StrategicExtraction> {
  const results: StrategicExtraction[] = []

  for (const chunk of chunks) {
    const userMsg = `${MARKDOWN_NOTE}

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

Document text (chunk ${chunk.chunk_index + 1} of ${chunks.length}):
---
${chunk.chunk_text}
---`

    const raw = await callLLM(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
      { jsonMode: true, meta: { purpose: 'strategic' } }
    )
    const parsed = await parseJsonWithRetry<StrategicExtraction>(raw, () =>
      callLLM(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' }],
        { jsonMode: true, meta: { purpose: 'strategic' } }
      )
    )
    results.push(parsed)
  }

  const merged = mergeFirstNonNull(results) as StrategicExtraction
  const seenNames = new Set<string>()
  const priorities: StrategicPriority[] = []
  for (const r of results) {
    for (const p of r.priorities ?? []) {
      if (!seenNames.has(p.priorityName)) {
        seenNames.add(p.priorityName)
        priorities.push(p)
      }
    }
  }
  return { ...merged, priorities }
}

export async function extractSustainability(chunks: ChunkRow[]): Promise<SustainabilityExtraction> {
  const results: SustainabilityExtraction[] = []

  for (const chunk of chunks) {
    const userMsg = `${MARKDOWN_NOTE}

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

Document text (chunk ${chunk.chunk_index + 1} of ${chunks.length}):
---
${chunk.chunk_text}
---`

    const raw = await callLLM(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
      { jsonMode: true, meta: { purpose: 'sustainability' } }
    )
    const parsed = await parseJsonWithRetry<SustainabilityExtraction>(raw, () =>
      callLLM(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' }],
        { jsonMode: true, meta: { purpose: 'sustainability' } }
      )
    )
    results.push(parsed)
  }

  const merged = mergeFirstNonNull(results) as SustainabilityExtraction
  const certs = Array.from(
    new Set(results.flatMap((r) => r.sustainabilityCertifications ?? []))
  )
  return { ...merged, sustainabilityCertifications: certs }
}

export async function extractKeyFacts(
  chunks: ChunkRow[],
  hint = 'Extract any quantitative facts or strategic statements relevant to a higher education consulting engagement.'
): Promise<KeyFactsExtraction> {
  const allFacts: KeyFact[] = []
  const seenNames = new Set<string>()

  for (const chunk of chunks) {
    const userMsg = `${MARKDOWN_NOTE}

Extract key facts and data points from the following institutional document text. ${hint}

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

Document text (chunk ${chunk.chunk_index + 1} of ${chunks.length}):
---
${chunk.chunk_text}
---`

    const raw = await callLLM(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
      { jsonMode: true, meta: { purpose: 'keyFacts' } }
    )
    const parsed = await parseJsonWithRetry<KeyFactsExtraction>(raw, () =>
      callLLM(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' }],
        { jsonMode: true, meta: { purpose: 'keyFacts' } }
      )
    )
    for (const fact of parsed.facts ?? []) {
      if (!seenNames.has(fact.kpiName)) {
        seenNames.add(fact.kpiName)
        allFacts.push(fact)
      }
    }
  }

  return { facts: allFacts }
}

export async function generateInsights(institutionName: string, compiledData: string): Promise<string> {
  const userPrompt = `You are a senior consultant at Deloitte Canada's Government & Public Services Higher Education practice.

You have been given structured data about ${institutionName}, a Canadian post-secondary institution. Your task is to produce a consulting intelligence briefing that a partner would use to prepare for a client meeting.

Respond in well-structured markdown with exactly these four sections:

## Top Consulting Opportunities
List the top 5 consulting opportunities, numbered 1–5 (highest priority first). For each, write a short paragraph (3–5 sentences) explaining the opportunity, the underlying driver, and the potential Deloitte service line (e.g. Technology Advisory, Financial Advisory, Strategy, People & Change, Risk Advisory).

## Key Risks & Challenges
List 4–6 bullet points covering material risks (financial, operational, reputational, regulatory) that the institution faces.

## Financial Health Summary
Write 2–3 paragraphs summarizing the institution's financial position, trends in revenue/expenses, surplus/deficit trajectory, and endowment strength. Use a balanced tone — note both strengths and concerns.

## Strategic Alignment Themes
List the dominant strategic themes evident in the data (e.g. Indigenization, Digital Transformation, Enrolment Management). For each theme, one sentence of evidence from the data.

---

INSTITUTION DATA:
${compiledData}`

  return callLLM([{ role: 'user', content: userPrompt }], { temperature: 0.4, maxTokens: 2000, meta: { purpose: 'insights' } })
}

// Merges an array of objects: first non-null value wins for each key
function mergeFirstNonNull<T>(items: T[]): T {
  const result: Record<string, unknown> = {}
  for (const item of items) {
    for (const key of Object.keys(item as object)) {
      const val = (item as Record<string, unknown>)[key]
      if (result[key] == null && val != null) {
        result[key] = val
      }
    }
  }
  return result as T
}
