# PRP — Phase 15: Docling Document Conversion (replace pdfjs)

## Context

Today, document ingestion is **PDF-only** and runs **entirely in the browser**. `src/components/DocumentUpload.tsx` filters to `application/pdf`, calls `extractPdfText()` in `src/services/pdfService.ts` (which uses `pdfjs-dist`), chunks the raw text, writes the document + chunks, and then `src/services/processingPipeline.ts` runs AI classification and extraction into `financial_summaries`, `strategic_priorities`, `kpi_datapoints`, and `sustainability_metrics`.

pdfjs only extracts a flat text stream — it loses table structure, and it cannot read DOCX, PPTX, XLSX, HTML, or images. **Docling** (https://www.docling.ai/) converts any of these formats into clean **Markdown** with tables preserved as Markdown pipe tables, which is far better input for the extraction prompts.

Docling is a Python tool and **cannot run in this browser-only SPA**. It runs as a separate service, **Docling Serve** (Docker image `quay.io/docling-project/docling-serve`, default port `5001`). The app calls it over HTTP, the same configurable-endpoint pattern used for the LiteLLM provider in Phase 14.

This phase **fully replaces pdfjs with Docling** for all uploads and **broadens accepted file types** to the Docling-supported set. The downstream chunking + AI extraction pipeline is unchanged — it now receives Markdown instead of pdfjs text. (Markdown-aware prompt tuning and setup hardening are Phase 16.)

> **Decision:** Docling is **required** for all uploads (no pdfjs fallback). If the Docling endpoint is unset or unreachable, the upload fails with a clear, actionable error.

### Docling Serve API (confirmed from the Polaris reference stack)
- **Request:** `POST {endpoint}/v1/convert/file`, `Content-Type: multipart/form-data`, with the file under form field **`files`**.
- **Response:** JSON `{ "document": { "md_content": "<markdown>", ... } }`.

---

## New file: `src/services/doclingService.ts`

```ts
import { getSetting } from '../db/db'

export interface ChunkInput {
  chunk_index: number
  chunk_text: string
  token_estimate: number
}

export interface ConversionResult {
  markdown: string
  wordCount: number
  chunks: ChunkInput[]
}

const CHUNK_SIZE = 12000
const CHUNK_OVERLAP = 200

function getDoclingEndpoint(): string {
  const endpoint = getSetting('docling_endpoint')
  if (!endpoint) {
    throw new Error('Please configure the Docling endpoint in Settings before uploading documents.')
  }
  return endpoint.replace(/\/$/, '')
}

export async function convertToMarkdown(file: File): Promise<ConversionResult> {
  const endpoint = getDoclingEndpoint()
  const form = new FormData()
  form.append('files', file, file.name)

  let resp: Response
  try {
    resp = await fetch(`${endpoint}/v1/convert/file`, { method: 'POST', body: form })
  } catch {
    throw new Error(`Could not reach Docling at ${endpoint}. Is Docling Serve running and reachable?`)
  }
  if (!resp.ok) {
    throw new Error(`Docling conversion failed: ${resp.status} ${resp.statusText}`)
  }

  const data = await resp.json() as { document?: { md_content?: string } }
  const markdown = data.document?.md_content ?? ''
  if (!markdown.trim()) {
    throw new Error('Docling returned no markdown content for this file.')
  }

  const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length
  return { markdown, wordCount, chunks: chunkText(markdown) }
}

// Carried over from pdfService.ts — markdown is just text.
export function chunkText(text: string): ChunkInput[] {
  const chunks: ChunkInput[] = []
  let start = 0
  let index = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    const content = text.slice(start, end)
    chunks.push({
      chunk_index: index,
      chunk_text: content,
      token_estimate: Math.ceil(content.length / 4),
    })
    if (end === text.length) break
    start = end - CHUNK_OVERLAP
    index++
  }
  return chunks
}

export async function testDoclingConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const endpoint = getDoclingEndpoint()
    const resp = await fetch(`${endpoint}/health`).catch(() => null)
    if (resp && resp.ok) return { success: true, message: 'Docling is reachable' }
    // Fall back to a tiny conversion if /health is not exposed
    const probe = new File(['# ping'], 'ping.md', { type: 'text/markdown' })
    await convertToMarkdown(probe)
    return { success: true, message: 'Docling is reachable' }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) }
  }
}
```

> `ChunkInput` and `chunkText` move here from `pdfService.ts`. Update the import in `src/db/documentDb.ts` (currently `import type { ChunkInput } from '../services/pdfService'`) to `'../services/doclingService'`.

---

## Retire pdfjs

- Delete `src/services/pdfService.ts` (its `chunkText` + `ChunkInput` now live in `doclingService.ts`; `extractPdfText` is removed).
- Remove `pdfjs-dist` from `package.json` dependencies, and remove the worker asset config (`public/pdf.worker*`, `pdfjsWorker` import). Confirm no other file imports `pdfjs-dist` before removing.

---

## New setting: `docling_endpoint`

`app_settings` is a generic key/value store, so **no `schema.ts` change**. Add one key:

| Key | Purpose | Example |
|---|---|---|
| `docling_endpoint` | Docling Serve base URL | `http://localhost:5001` |

Document it under the `app_settings` "Keys in use" list in `docs/DATABASE.md`.

---

## Changes: `src/pages/Settings.tsx`

Add a **"Document Conversion (Docling)"** section (mirrors the AI Provider section pattern):

```tsx
const [doclingEndpoint, setDoclingEndpoint] = useState('')

// in the load effect:
setDoclingEndpoint(getSetting('docling_endpoint') ?? '')

// in saveSettings():
setSetting('docling_endpoint', doclingEndpoint)
```

UI: an Endpoint URL field (placeholder `http://localhost:5001`) plus a **Test Connection** button wired to `testDoclingConnection()` that shows a success/error toast (same pattern as the existing AI Test Connection button).

---

## Changes: `src/context/ProcessingContext.tsx` and `src/components/ProcessingStatusBar.tsx`

Add a `converting` step so users see the Docling phase:

```ts
// ProcessingContext.tsx — ProcessingStep union
export type ProcessingStep =
  | 'reading'
  | 'converting'   // NEW — Docling conversion
  | 'chunking'
  | 'saving'
  | 'classifying'
  | 'awaiting_confirmation'
  | 'extracting_data'
  | 'writing_db'
  | 'complete'
  | 'failed'
```

```ts
// ProcessingStatusBar.tsx — STEP_LABELS
converting: 'Converting with Docling…',
```

(The old `extracting` label/step is replaced by `converting`.)

---

## Changes: `src/components/DocumentUpload.tsx`

Replace the PDF-only flow with Docling conversion across the broad file set.

1. **Accepted types** — define the allowed set and use it for both filtering and the input `accept` attribute:

```ts
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp']

function isAccepted(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}
```

2. **`processFiles`** — filter with `isAccepted` (error toast "Unsupported file type" when none match), then per file:

```ts
import { convertToMarkdown } from '../services/doclingService'

updateJob({ id: jobId, step: 'converting', progress: 25 })
const { markdown, wordCount, chunks } = await convertToMarkdown(file)

updateJob({ id: jobId, step: 'chunking', progress: 50 })
docId = createDocument({
  institution_id: instId,
  filename: file.name,
  page_count: 0,            // not derivable outside pdfjs; default 0
  word_count: wordCount,
  raw_text: markdown,       // markdown stored in the existing raw_text column
})

updateJob({ id: jobId, step: 'saving', progress: 75 })
saveChunks(docId, chunks)

await runProcessingPipeline(/* unchanged */)
```

3. **Drop-zone copy + input** — update text and `accept`:

```tsx
<p className="text-sm font-medium text-slate-700">Drop documents here or click to browse</p>
<p className="text-xs text-slate-400 mt-1">PDF, Word, PowerPoint, Excel, HTML, and images · Multiple files supported</p>
<input ref={inputRef} type="file"
  accept={ACCEPTED_EXTENSIONS.join(',')}
  multiple className="hidden" onChange={onInputChange} />
```

Remove the `extractPdfText` import and the `f.type === 'application/pdf'` filter.

---

## Files Modified

| File | Change |
|---|---|
| `src/services/doclingService.ts` | New — `convertToMarkdown()`, `chunkText()`, `ChunkInput`, `testDoclingConnection()` |
| `src/services/pdfService.ts` | Deleted (pdfjs retired) |
| `src/db/documentDb.ts` | Update `ChunkInput` import to `doclingService` |
| `src/pages/Settings.tsx` | New "Document Conversion (Docling)" section + Test Connection; load/save `docling_endpoint` |
| `src/context/ProcessingContext.tsx` | Add `converting` step (replaces `extracting`) |
| `src/components/ProcessingStatusBar.tsx` | Add `converting` label |
| `src/components/DocumentUpload.tsx` | Broad accepted types; call `convertToMarkdown()`; store markdown; updated copy/accept |
| `docs/DATABASE.md` | Document `docling_endpoint` key |
| `package.json` | Remove `pdfjs-dist` |

No changes to `src/db/schema.ts`.

---

## Verification

1. `npm run build` — no TypeScript errors; no remaining `pdfjs-dist` imports.
2. With Docling Serve running (`docling-serve`, port 5001) and `docling_endpoint` set in Settings, **Test Connection** succeeds.
3. Upload a **PDF**: status bar shows "Converting with Docling…", `documents.raw_text` contains Markdown, `document_chunks` rows are created, and the existing data tabs populate after classification/extraction.
4. Upload a **DOCX** (and one other non-PDF type): converts and processes through the same pipeline.
5. With `docling_endpoint` blank or Docling stopped, an upload fails with a clear toast ("Please configure the Docling endpoint…" / "Could not reach Docling…") and the document is marked `failed`.
