# PRP — Phase 21: End-to-End Upload Smoke Test

## Context

Phases 15–20 stood up the full ingestion stack: **Docling** (PDF → Markdown) and a self-hosted **LiteLLM** proxy (classification + extraction). Right now the only way to confirm the stack actually works is to drive the browser UI by hand — which is slow and easy to skip, and was exactly how a document recently got stuck at "processing" without anyone noticing the LLM was down.

This phase adds a **repeatable, dependency-light integration smoke test** that runs the real pipeline against a real document — the U of T financial report — and asserts each stage produces sane output:

```
PDF  ──Docling──▶  Markdown  ──chunk──▶  chunks  ──LiteLLM──▶  classification  ──LiteLLM──▶  financials
```

The test fixture is:

```
/Users/chrfernandes/Library/CloudStorage/OneDrive-Deloitte(O365D)/Documents/PRD/Instutional Analysis App/UofT/UofT-April-30-2025-Financial-Report.pdf
```

> Design choice: this is a **black-box Node script**, not a browser/Vitest/Playwright suite. The app's services (`doclingService`, `aiService`) import the `sql.js`/`localStorage` DB layer, which can't run in Node. So the test re-implements only the two HTTP calls it needs (multipart convert + chat completion), mirroring `convertToMarkdown()` and `callLLM()`, and exercises the **same running containers** the app uses. No new dependencies — Node 18+ has global `fetch`, `FormData`, and `Blob`.

> Prerequisite: the stack must be up (`npm run dev`, or the containers running). The script reads the LiteLLM key from `.env.litellm` so it stays in sync with the app config.

---

## New file: `scripts/test-upload.mjs`

A Node ESM smoke test. Config via env with sensible defaults (so `npm run test:upload` works with zero args), overridable for ad-hoc runs.

- `PDF_PATH` — default: the U of T report path above.
- `DOCLING_URL` — default `http://localhost:5001`.
- `LITELLM_URL` — default `http://localhost:4001/v1`.
- `LITELLM_MODEL` — default `gpt-4o`.
- `LITELLM_KEY` — default read from `.env.litellm` (`LITELLM_MASTER_KEY`).

Stages and assertions:
1. **Convert** — multipart `POST {DOCLING_URL}/v1/convert/file`; assert `document.md_content` is non-empty, contains "University of Toronto", and contains at least one Markdown pipe table row (`|`). Print word count.
2. **Chunk** — reuse the app's chunking constants (`CHUNK_SIZE = 12000`, `CHUNK_OVERLAP = 200`); assert ≥1 chunk.
3. **Classify** — `POST {LITELLM_URL}/chat/completions` (Bearer key, `response_format: json_object`) with the app's `SYSTEM_PROMPT` + classification prompt over chunks 0–1; assert valid JSON, `documentType` ∈ {Financial Statement, Annual Report}, and `institutionName` mentions "Toronto".
4. **Extract financials** — same call with the financials prompt over the first chunk; assert valid JSON and at least one of `totalRevenue` / `totalExpenses` / `netAssets` is a number.

Each stage prints `✓`/`✗`; the script exits non-zero on the first failure so it's CI-friendly.

```js
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function readEnvFile(name) {
  const p = path.join(ROOT, name)
  const out = {}
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

const fileEnv = readEnvFile('.env.litellm')
const PDF_PATH = process.env.PDF_PATH ??
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
const bad = (m) => { console.error(`  \u2717 ${m}`); failures++ }
const fatal = (m) => { console.error(`\nFAILED: ${m}`); process.exit(1) }

function chunkText(text) {
  const chunks = []
  let start = 0, index = 0
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
    body: JSON.stringify({ model: LITELLM_MODEL, messages, temperature: 0.1, max_tokens: 4096, response_format: { type: 'json_object' } }),
  })
  if (!resp.ok) throw new Error(`LiteLLM ${resp.status} ${resp.statusText} — ${await resp.text()}`)
  const data = await resp.json()
  return data.choices[0].message.content
}

async function main() {
  console.log(`Upload smoke test\n  PDF:     ${PDF_PATH}\n  Docling: ${DOCLING_URL}\n  LiteLLM: ${LITELLM_URL} (${LITELLM_MODEL})\n`)
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
  } catch (e) { fatal(`could not reach Docling at ${DOCLING_URL} — is it running? (${e.message})`) }
  md.trim() ? ok(`markdown returned (${md.trim().split(/\s+/).length} words)`) : bad('empty markdown')
  /Toronto/i.test(md) ? ok('mentions University of Toronto') : bad('expected "Toronto" in markdown')
  md.includes('|') ? ok('contains a Markdown pipe table') : bad('no pipe table found')

  // 2. Chunk
  console.log('2. Chunking')
  const chunks = chunkText(md)
  chunks.length ? ok(`${chunks.length} chunk(s)`) : bad('no chunks produced')

  // 3. Classify
  console.log('3. Classification (LiteLLM)')
  const classifyMsg = `Classify the following document excerpt from a Canadian post-secondary institution.\n\nReturn a JSON object with exactly these fields:\n{\n  "documentType": one of "Financial Statement", "Strategic Plan", "Sustainability Report", "Annual Report", "Other",\n  "fiscalYear": "YYYY" or null if not found,\n  "institutionName": the full institution name as it appears in the document, or null,\n  "confidence": a number between 0 and 1 indicating your confidence in the classification\n}\n\nDocument text:\n---\n${chunks[0]?.chunk_text ?? ''}\n${chunks[1]?.chunk_text ?? ''}\n---`
  try {
    const cls = JSON.parse(await callLLM([{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: classifyMsg }]))
    ;['Financial Statement', 'Annual Report'].includes(cls.documentType)
      ? ok(`documentType = ${cls.documentType}`) : bad(`unexpected documentType: ${cls.documentType}`)
    /Toronto/i.test(cls.institutionName ?? '') ? ok(`institutionName = ${cls.institutionName}`) : bad(`institutionName: ${cls.institutionName}`)
  } catch (e) { fatal(`classification failed — LLM unreachable or bad JSON (${e.message})`) }

  // 4. Extract financials
  console.log('4. Financial extraction (LiteLLM)')
  const finMsg = `${MARKDOWN_NOTE}\n\nExtract financial data from the following text of a Canadian post-secondary institution's financial statement.\n\nReturn a JSON object with these fields (null if not found): {"fiscalYear","totalRevenue","totalExpenses","netSurplusDeficit","totalAssets","totalLiabilities","netAssets","endowmentValue","notes"}. All monetary values in Canadian dollars, no commas.\n\nDocument text:\n---\n${chunks[0].chunk_text}\n---`
  try {
    const fin = JSON.parse(await callLLM([{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: finMsg }]))
    const nums = ['totalRevenue', 'totalExpenses', 'netAssets'].filter((k) => typeof fin[k] === 'number')
    nums.length ? ok(`extracted ${nums.join(', ')}`) : bad('no numeric financial fields extracted from first chunk')
  } catch (e) { fatal(`financial extraction failed (${e.message})`) }

  console.log(`\n${failures ? `FAILED with ${failures} assertion error(s)` : 'PASSED — full pipeline works end to end'}`)
  process.exit(failures ? 1 : 0)
}

main()
```

> The financial assertion checks only the **first chunk** (revenue/expenses/net-assets statements usually appear early). If a future fixture buries them deeper, widen the loop over more chunks rather than weakening the assertion.

---

## Changes: `package.json`

Add a script:

```jsonc
"scripts": {
  "test:upload": "node scripts/test-upload.mjs"
}
```

---

## Files Modified

| File | Change |
|---|---|
| `scripts/test-upload.mjs` | New — black-box pipeline smoke test (Docling convert → chunk → classify → extract) |
| `package.json` | Add `test:upload` script |

No app source or schema changes.

---

## Verification

1. Start the stack: `npm run dev` (Docling on 5001, LiteLLM on 4001) and confirm Settings → both Test Connections pass.
2. Run `npm run test:upload`. Expect each stage to print `✓` and a final `PASSED — full pipeline works end to end`, exit code 0.
3. Stop LiteLLM (`npm run litellm:stop`) and re-run — the test fails fast at stage 3 with a clear "LLM unreachable" message and exit code 1 (proves it catches the stuck-at-"processing" scenario).
4. Stop Docling and re-run — fails fast at stage 1 with a "could not reach Docling" message.
5. Manual UI cross-check (optional): drag the same PDF onto an institution's Documents tab → status advances through Converting → Classifying → confirmation modal (type "Financial Statement") → Extracting → processed; the Financials tab shows U of T revenue/expense rows.
