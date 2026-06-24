import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readEnvFile(name) {
  const p = path.join(ROOT, name)
  const out = {}
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2]
    }
  }
  return out
}

const fileEnv = readEnvFile('.env.litellm')
const PDF_PATH =
  process.env.PDF_PATH ??
  '/Users/chrfernandes/Library/CloudStorage/OneDrive-Deloitte(O365D)/Documents/PRD/Instutional Analysis App/UofT/UofT-April-30-2025-Financial-Report.pdf'
const DOCLING_URL = (process.env.DOCLING_URL ?? 'http://localhost:5001').replace(/\/$/, '')
const LITELLM_URL = (process.env.LITELLM_URL ?? 'http://localhost:4001/v1').replace(/\/$/, '')
const LITELLM_MODEL = process.env.LITELLM_MODEL ?? 'gpt-4o'
const LITELLM_KEY = process.env.LITELLM_KEY ?? fileEnv.LITELLM_MASTER_KEY ?? ''

const CHUNK_SIZE = 12000
const CHUNK_OVERLAP = 200

const SYSTEM_PROMPT = `You are a higher education sector analyst specializing in Canadian post-secondary institutions. Your role is to extract structured data from institutional documents and identify strategic patterns, financial trends, and intelligence valuable to a management consulting team at Deloitte Canada.

Always output valid JSON only, with no preamble, explanation, or markdown fences. The JSON must be parseable by JSON.parse() with no modifications.`

const MARKDOWN_NOTE = `The document text below is in Markdown produced by Docling. Tables are represented as Markdown pipe tables (rows separated by newlines, cells by "|") — read them column-by-column and align each value with its row and column header. Headings (#) mark sections.`

let failures = 0
const ok = (m) => console.log(`  \u2713 ${m}`)
const bad = (m) => {
  console.error(`  \u2717 ${m}`)
  failures++
}
const fatal = (m) => {
  console.error(`\nFAILED: ${m}`)
  process.exit(1)
}

function chunkText(text) {
  const chunks = []
  let start = 0
  let index = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push({ chunk_index: index, chunk_text: text.slice(start, end) })
    if (end === text.length) break
    start = end - CHUNK_OVERLAP
    index++
  }
  return chunks
}

async function callLLM(messages) {
  const resp = await fetch(`${LITELLM_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LITELLM_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LITELLM_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  })
  if (!resp.ok) throw new Error(`LiteLLM ${resp.status} ${resp.statusText} — ${await resp.text()}`)
  const data = await resp.json()
  return data.choices[0].message.content
}

async function main() {
  console.log(
    `Upload smoke test\n  PDF:     ${PDF_PATH}\n  Docling: ${DOCLING_URL}\n  LiteLLM: ${LITELLM_URL} (${LITELLM_MODEL})\n`
  )
  if (!existsSync(PDF_PATH)) fatal(`fixture not found: ${PDF_PATH}`)
  if (!LITELLM_KEY) fatal('LITELLM_KEY not set and LITELLM_MASTER_KEY missing from .env.litellm')

  // 1. Convert
  console.log('1. Docling conversion')
  const buf = readFileSync(PDF_PATH)
  const form = new FormData()
  form.append('files', new Blob([buf], { type: 'application/pdf' }), path.basename(PDF_PATH))
  let md = ''
  try {
    const resp = await fetch(`${DOCLING_URL}/v1/convert/file`, { method: 'POST', body: form })
    if (!resp.ok) fatal(`Docling ${resp.status} ${resp.statusText}`)
    md = (await resp.json())?.document?.md_content ?? ''
  } catch (e) {
    fatal(`could not reach Docling at ${DOCLING_URL} — is it running? (${e.message})`)
  }
  md.trim() ? ok(`markdown returned (${md.trim().split(/\s+/).length} words)`) : bad('empty markdown')
  /Toronto/i.test(md) ? ok('mentions University of Toronto') : bad('expected "Toronto" in markdown')
  md.includes('|') ? ok('contains a Markdown pipe table') : bad('no pipe table found')

  // 2. Chunk
  console.log('2. Chunking')
  const chunks = chunkText(md)
  chunks.length ? ok(`${chunks.length} chunk(s)`) : bad('no chunks produced')

  // 3. Classify
  console.log('3. Classification (LiteLLM)')
  const classifyMsg = `Classify the following document excerpt from a Canadian post-secondary institution.

Return a JSON object with exactly these fields:
{
  "documentType": one of "Financial Statement", "Strategic Plan", "Sustainability Report", "Annual Report", "Other",
  "fiscalYear": "YYYY" or null if not found,
  "institutionName": the full institution name as it appears in the document, or null,
  "confidence": a number between 0 and 1 indicating your confidence in the classification
}

Document text:
---
${chunks[0]?.chunk_text ?? ''}
${chunks[1]?.chunk_text ?? ''}
---`
  try {
    const cls = JSON.parse(
      await callLLM([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: classifyMsg },
      ])
    )
    ;['Financial Statement', 'Annual Report'].includes(cls.documentType)
      ? ok(`documentType = ${cls.documentType}`)
      : bad(`unexpected documentType: ${cls.documentType}`)
    /Toronto/i.test(cls.institutionName ?? '')
      ? ok(`institutionName = ${cls.institutionName}`)
      : bad(`institutionName: ${cls.institutionName}`)
  } catch (e) {
    fatal(`classification failed — LLM unreachable or bad JSON (${e.message})`)
  }

  // 4. Extract financials. The figures live in the statement chunks, not the
  // cover/TOC, so scan the first several chunks and pass on the first hit
  // (mirrors how the app's extractFinancials iterates over all chunks).
  console.log('4. Financial extraction (LiteLLM)')
  const finPrompt = (chunkText) => `${MARKDOWN_NOTE}

Extract financial data from the following text of a Canadian post-secondary institution's financial statement.

Return a JSON object with these fields (null if not found): {"fiscalYear","totalRevenue","totalExpenses","netSurplusDeficit","totalAssets","totalLiabilities","netAssets","endowmentValue","notes"}. All monetary values in Canadian dollars, no commas.

Document text:
---
${chunkText}
---`
  const MAX_FIN_CHUNKS = 8
  const scanned = Math.min(MAX_FIN_CHUNKS, chunks.length)
  let foundChunk = -1
  let foundFields = []
  for (let i = 0; i < scanned; i++) {
    try {
      const fin = JSON.parse(
        await callLLM([
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: finPrompt(chunks[i].chunk_text) },
        ])
      )
      const nums = ['totalRevenue', 'totalExpenses', 'netAssets'].filter((k) => typeof fin[k] === 'number')
      if (nums.length) {
        foundChunk = i
        foundFields = nums
        break
      }
    } catch (e) {
      fatal(`financial extraction failed on chunk ${i} (${e.message})`)
    }
  }
  foundChunk >= 0
    ? ok(`extracted ${foundFields.join(', ')} from chunk ${foundChunk} (scanned ${scanned})`)
    : bad(`no numeric financial fields found in first ${scanned} chunk(s)`)

  console.log(
    `\n${failures ? `FAILED with ${failures} assertion error(s)` : 'PASSED — full pipeline works end to end'}`
  )
  process.exit(failures ? 1 : 0)
}

main()
