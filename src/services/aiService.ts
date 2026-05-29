import { getSetting } from '../db/db'
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

async function callAzureOpenAI(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { jsonMode?: boolean; temperature?: number; maxTokens?: number }
): Promise<string> {
  const { endpoint, apiKey, deployment, apiVersion } = getAzureConfig()
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`

  const body: Record<string, unknown> = {
    messages,
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 4096,
  }
  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 10000))
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (resp.status === 429) {
      lastError = new Error('Rate limited (429). Retrying…')
      continue
    }
    if (!resp.ok) {
      throw new Error(`Azure OpenAI error: ${resp.status} ${resp.statusText}`)
    }
    const data = await resp.json() as { choices: { message: { content: string } }[] }
    return data.choices[0].message.content
  }
  throw lastError ?? new Error('Azure OpenAI request failed after retries')
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
    await callAzureOpenAI([
      { role: 'system', content: 'Reply with exactly: ok' },
      { role: 'user', content: 'ping' },
    ], { maxTokens: 10 })
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

  const raw = await callAzureOpenAI(
    [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
    { jsonMode: true }
  )
  return parseJsonWithRetry<ClassificationResult>(raw, () =>
    callAzureOpenAI(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' },
      ],
      { jsonMode: true }
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
      const userMsg = `Extract financial data from the following text of a Canadian post-secondary institution's financial statement.

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

      const raw = await callAzureOpenAI(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
        { jsonMode: true }
      )
      const parsed = await parseJsonWithRetry<FinancialExtraction>(raw, () =>
        callAzureOpenAI(
          [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' }],
          { jsonMode: true }
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
    const userMsg = `Extract strategic priorities from the following text of a Canadian post-secondary institution's strategic plan.

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

    const raw = await callAzureOpenAI(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
      { jsonMode: true }
    )
    const parsed = await parseJsonWithRetry<StrategicExtraction>(raw, () =>
      callAzureOpenAI(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' }],
        { jsonMode: true }
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
    const userMsg = `Extract sustainability and environmental data from the following text of a Canadian post-secondary institution's sustainability report.

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

    const raw = await callAzureOpenAI(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
      { jsonMode: true }
    )
    const parsed = await parseJsonWithRetry<SustainabilityExtraction>(raw, () =>
      callAzureOpenAI(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' }],
        { jsonMode: true }
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

export async function extractKeyFacts(chunks: ChunkRow[]): Promise<KeyFactsExtraction> {
  const allFacts: KeyFact[] = []
  const seenNames = new Set<string>()

  for (const chunk of chunks) {
    const userMsg = `Extract key facts and data points from the following institutional document text. Focus on facts relevant to a consulting firm that advises Canadian post-secondary institutions.

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

    const raw = await callAzureOpenAI(
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
      { jsonMode: true }
    )
    const parsed = await parseJsonWithRetry<KeyFactsExtraction>(raw, () =>
      callAzureOpenAI(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMsg + '\nReturn only valid JSON with no preamble.' }],
        { jsonMode: true }
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
