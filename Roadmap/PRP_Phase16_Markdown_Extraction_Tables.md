# PRP — Phase 16: Markdown-Aware Extraction & Setup Hardening

## Context

Phase 15 replaced pdfjs with Docling: any uploaded file is converted to **Markdown** (tables preserved as Markdown pipe tables), chunked, and fed to the existing AI extraction pipeline in `src/services/processingPipeline.ts`, which writes `financial_summaries`, `strategic_priorities`, `kpi_datapoints`, and `sustainability_metrics`.

The extraction prompts in `src/services/aiService.ts` were written for flat pdfjs text. They still work on Markdown, but they don't tell the model that the input is Markdown or that numeric/financial data now appears as clean Markdown tables — so they under-use Docling's biggest advantage. This phase tunes extraction for Markdown, makes sure the broadened file set routes to the right extractors, hardens the conversion call for slow/large documents, and documents how to run Docling Serve so the browser SPA can reach it.

This phase makes **no schema changes** and **no change to the extraction JSON contracts** — only prompt wording, routing coverage, robustness, and docs.

---

## 1. Markdown-aware extraction prompts — `src/services/aiService.ts`

Add a shared preamble sentence to the extraction user messages so the model treats the input as Markdown and reads tables column-by-column.

Define once near the top of the file:

```ts
const MARKDOWN_NOTE =
  'The document text below is in Markdown produced by Docling. Tables are represented as Markdown pipe tables (rows separated by newlines, cells by "|") — read them column-by-column and align each value with its row and column header. Headings (#) mark sections.'
```

Inject it into the four extraction prompts:
- `extractFinancials()` — prepend `MARKDOWN_NOTE` before the "Extract financial data…" instruction. This is the highest-value change: financial statements are dense tables.
- `extractSustainability()` — prepend `MARKDOWN_NOTE`.
- `extractKeyFacts()` — prepend `MARKDOWN_NOTE` (after the existing `hint`).
- `extractStrategicPriorities()` — prepend `MARKDOWN_NOTE`.

The `SYSTEM_PROMPT`, JSON output structures, and `parseJsonWithRetry` flow stay exactly the same. `classifyDocument()` needs no change — it still reads the first one or two Markdown chunks.

---

## 2. Document-type coverage — `src/services/documentTypeRegistry.ts` and `ClassificationConfirmModal`

Now that non-PDF inputs are supported (spreadsheets, enrolment/budget exports, etc.), confirm routing is sensible:
- The registry already defines `Financial Statement`, `Strategic Plan`, `Sustainability Report`, `Annual Report`, `Enrolment Report`, `Budget Submission`, `Research Report`, `Other`. No new types are required, but verify each maps to the intended extractors and `targetTables`.
- `ClassificationConfirmModal` already populates its dropdown from `DOCUMENT_TYPE_LABELS`, so any registry additions appear automatically. Confirm the modal still lets the user override the detected type — important because classification confidence may differ across formats (e.g. an XLSX budget export).
- No code change is expected here beyond verification; if a gap is found (a common upload that has no good type), add it to the registry following the Phase 11 pattern.

---

## 3. Long-running conversions / robustness — `src/services/doclingService.ts`

Large or scanned documents can take minutes to convert. Make `convertToMarkdown()` resilient:

- **Timeout + abort:** wrap the `fetch` in an `AbortController` with a generous timeout (e.g. 300000 ms) and surface a friendly error on abort: `"Docling conversion timed out for {filename}. Try a smaller file or enable Docling's async endpoint."`

```ts
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 300000)
try {
  resp = await fetch(`${endpoint}/v1/convert/file`, { method: 'POST', body: form, signal: controller.signal })
} catch (e) {
  if ((e as Error).name === 'AbortError') throw new Error(`Docling conversion timed out for ${file.name}.`)
  throw new Error(`Could not reach Docling at ${endpoint}. Is Docling Serve running and reachable?`)
} finally {
  clearTimeout(timer)
}
```

- **Async upgrade path (documented, optional to implement):** Docling Serve also exposes an asynchronous API — submit via `POST /v1/convert/source/async`, then poll `GET /v1/status/poll/{task_id}` until done and fetch the result. Document this in the PRP as the path to take if synchronous `/v1/convert/file` proves too slow in practice; the sync path remains the default.

---

## 4. CORS / setup documentation

Because the SPA calls Docling **from the browser**, Docling Serve must allow cross-origin requests from the app origin (`http://localhost:5173`). Add a short **"Running Docling Serve"** section to `docs/` (e.g. a new `docs/DOCLING.md`, linked from `README` / `INSTALL` if present) covering:
- Running the container, mirroring the Polaris reference service: `quay.io/docling-project/docling-serve`, port `5001`, `DOCLING_SERVE_ENABLE_UI=1`, and a long sync wait (`DOCLING_SERVE_MAX_SYNC_WAIT`) for OCR-heavy files.

```bash
docker run --rm -p 5001:5001 \
  -e DOCLING_SERVE_ENABLE_UI=1 \
  -e DOCLING_SERVE_MAX_SYNC_WAIT=540 \
  quay.io/docling-project/docling-serve:latest
```

- Enabling CORS so the browser can call it — document the relevant `docling-serve` CORS env/flag (allow origin `http://localhost:5173`, or `*` for local use). If a given `docling-serve` build does not expose a CORS setting, document the fallback of running it behind a small reverse proxy that adds `Access-Control-Allow-Origin`.
- Pointing the app at it: set `docling_endpoint` to `http://localhost:5001` in Settings and click **Test Connection** (Phase 15).

---

## Files Modified

| File | Change |
|---|---|
| `src/services/aiService.ts` | Add `MARKDOWN_NOTE`; inject into the four extraction prompts |
| `src/services/doclingService.ts` | Timeout/abort handling + friendly errors |
| `src/services/documentTypeRegistry.ts` | Verify/extend type→extractor routing (only if a gap is found) |
| `src/components/ClassificationConfirmModal.tsx` | Verify override + registry-driven dropdown (likely no change) |
| `docs/DOCLING.md` | New — running Docling Serve, CORS, async upgrade path |

No changes to `src/db/schema.ts` and no changes to extraction JSON contracts.

---

## Verification

1. `npm run build` — no TypeScript errors.
2. **Markdown tables:** upload a financial statement; confirm `financial_summaries` values match the source tables more accurately than before (spot-check revenue/expenses/net surplus).
3. **File-type matrix** (with Docling Serve running) — each converts and produces extracted rows where applicable:

   | Type | Example | Expectation |
   |---|---|---|
   | PDF | Annual report | financials + priorities + sustainability + KPIs |
   | DOCX | Strategic plan | priorities + KPIs |
   | PPTX | Board deck | key facts / KPIs |
   | XLSX | Budget/enrolment export | financials or KPIs |
   | HTML | Web report | type-appropriate rows |
   | Image | Scanned statement | OCR'd, then extracted |

4. **Robustness:** a very large/scanned file either completes or fails with the friendly timeout message (not a silent hang); the document is marked `failed` with the message visible in the document detail panel.
5. **Docs:** following `docs/DOCLING.md` from a clean machine yields a reachable Docling endpoint that passes Settings → Test Connection.
