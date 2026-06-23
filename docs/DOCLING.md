# Running Docling Serve

The HE Industry Tracker converts every uploaded document (PDF, Word, PowerPoint, Excel, HTML, images) to Markdown before extraction. Conversion is done by **Docling Serve** — a small service you run locally. The app calls it over HTTP from the browser, so two things must be true:

1. Docling Serve is running and reachable at the URL you set in **Settings → Document Conversion (Docling)**.
2. Docling Serve allows cross-origin requests from the app origin (`http://localhost:5173`).

---

## 1. Start Docling Serve

> **Auto-start:** `npm run dev` now starts Docling automatically (via `scripts/start-docling.mjs`) alongside Vite. This requires **Docker or Podman** to be installed and running; the first run pulls the `docling-serve` image, which can take a few minutes. If you prefer to run Docling yourself — or you run only the frontend with `npm run dev:app` — use the manual command below. Stop an auto-started container with `npm run docling:stop`.

Using Docker (or Podman — replace `docker` with `podman`):

```bash
docker run --rm -p 5001:5001 \
  -e DOCLING_SERVE_ENABLE_UI=1 \
  -e DOCLING_SERVE_MAX_SYNC_WAIT=540 \
  quay.io/docling-project/docling-serve:latest
```

- `-p 5001:5001` — exposes the API on `http://localhost:5001`.
- `DOCLING_SERVE_ENABLE_UI=1` — serves a debug UI at `http://localhost:5001/ui` (optional, handy for sanity checks).
- `DOCLING_SERVE_MAX_SYNC_WAIT=540` — lets OCR-heavy / large documents finish on the synchronous endpoint instead of timing out. Keep this below the app's client-side conversion timeout (300s) is not required, but a higher server wait reduces premature failures.

The app uses the **synchronous** endpoint: `POST /v1/convert/file` (multipart form, file under field `files`), and reads `document.md_content` from the JSON response.

---

## 2. Enable CORS

Because the SPA calls Docling directly from the browser, Docling Serve must return `Access-Control-Allow-Origin` for the app origin. Allow `http://localhost:5173` (the Vite dev server), or `*` for local-only use.

Docling Serve exposes CORS configuration via environment variables, e.g.:

```bash
docker run --rm -p 5001:5001 \
  -e DOCLING_SERVE_ENABLE_UI=1 \
  -e DOCLING_SERVE_MAX_SYNC_WAIT=540 \
  -e DOCLING_SERVE_CORS_ORIGINS='["http://localhost:5173"]' \
  quay.io/docling-project/docling-serve:latest
```

> The exact variable name can vary between `docling-serve` releases. Check your image's docs/help for the CORS option it supports. If the build you have does not expose a CORS setting, run Docling behind a small reverse proxy (nginx/Caddy) that adds `Access-Control-Allow-Origin: http://localhost:5173` to responses.

---

## 3. Point the app at it

1. In the app, open **Settings → Document Conversion (Docling)**.
2. Set **Endpoint URL** to `http://localhost:5001`.
3. Click **Save Settings**, then **Test Connection** — you should see a success toast.
4. Upload a document from an institution's Documents tab. The processing status bar shows "Converting with Docling…", then classification and extraction proceed as usual.

---

## Troubleshooting

- **"Could not reach Docling…"** — Docling Serve isn't running or the URL/port is wrong. Confirm `http://localhost:5001/ui` loads (if UI enabled), or check the container logs.
- **CORS error in the browser console** — Docling is reachable but isn't allowing the app origin. Configure CORS (Step 2) and reload.
- **"Docling conversion timed out…"** — the file is large or scanned and exceeded the app's 300s client timeout. Try a smaller file, raise `DOCLING_SERVE_MAX_SYNC_WAIT`, or use the asynchronous flow (below).

---

## Large files: asynchronous conversion (upgrade path)

The app currently uses the synchronous `POST /v1/convert/file`, which is simplest but blocks until the conversion finishes. For very large or OCR-heavy documents, Docling Serve also offers an **asynchronous** flow:

1. `POST /v1/convert/source/async` — submit the source; returns a `task_id`.
2. `GET /v1/status/poll/{task_id}` — poll until the task reports completion.
3. Fetch the converted result (Markdown) once the task is done.

If synchronous conversion proves too slow in practice, `convertToMarkdown()` in [`src/services/doclingService.ts`](../src/services/doclingService.ts) can be reworked to submit-and-poll using these endpoints, surfacing poll progress through the existing `converting` processing step.
