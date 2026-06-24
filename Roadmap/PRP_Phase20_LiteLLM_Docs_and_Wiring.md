# PRP — Phase 20: LiteLLM Setup Docs & App Configuration

## Context

Phases 18–19 deliver the self-hosted LiteLLM image, static config, and Colima-aware auto-start. This phase closes the loop: a setup doc (mirroring `docs/DOCLING.md`) and the exact in-app Settings values, then an end-to-end verification of the full ingestion pipeline against the local proxy.

No code or schema changes — the app already supports LiteLLM via `src/services/aiService.ts` (it posts to `${litellm_base_url}/chat/completions` with a Bearer key and a `model` field; see lines 68–72) and the Settings UI from Phase 14. This phase is documentation + configuration + verification.

---

## New file: `docs/LITELLM.md`

Structured like `docs/DOCLING.md`. Sections:

- **What it is** — a project-owned LiteLLM proxy on port **4001**, independent of Polaris (port 4000); both can run at once. Holds the real Azure keys so the browser only needs a base URL, bearer token, and model name.
- **One-time setup**:
  1. `cp .env.litellm.example .env.litellm` and fill `LITELLM_MASTER_KEY` (e.g. `sk-he-tracker-local`), `AZURE_API_BASE`, `AZURE_API_KEY`, `AZURE_API_VERSION`, and the two `NETSKOPE_*_CA_B64` values (reuse from the Polaris `.env`).
  2. Set the Azure **deployment name** in `litellm/litellm_config.yaml` (`model: azure/<deployment>`).
- **Running it** — `npm run dev` auto-starts it (Phase 19); first run starts Colima and builds the image (a few minutes). Manual fallback: the `docker build` / `docker run` commands from Phase 18. Stop with `npm run litellm:stop`.
- **Colima requirement** — no Docker Desktop on this machine; the launcher runs `colima start` automatically, or run it yourself. Verify with `docker info`.
- **Point the app at it** — Settings → AI Provider:
  - Provider: **LiteLLM (OpenAI-compatible)**
  - Base URL: `http://localhost:4001/v1`
  - API Key: the `LITELLM_MASTER_KEY` value
  - Model Name: `gpt-4o` (must match a `model_name` in `litellm_config.yaml`)
  - Click **Test Connection** → success.
- **Adding models** — add another `model_list` entry in `litellm_config.yaml`, restart the container (`npm run litellm:stop` then `npm run dev`), and use the new `model_name` in Settings.
- **Troubleshooting** — port 4001 in use, TLS/cert errors (CA build args empty), `.env.litellm` missing, model-name mismatch (`400 ... not found`); how this differs from the Polaris stack.

---

## App configuration (no code change)

Enter the values above in Settings. Because LiteLLM runs on a different port than Polaris, this points the app at the project's own proxy regardless of whether Polaris is up.

---

## Files Modified

| File | Change |
|---|---|
| `docs/LITELLM.md` | New — setup, Colima requirement, exact Settings values, troubleshooting |

No app source or schema changes.

---

## Verification

1. With LiteLLM running on 4001 and Settings configured per the doc, **Test Connection** returns success.
2. Upload a document: Docling converts it, then classification + extraction populate the data tabs — all LLM traffic flows through `localhost:4001` (confirm in the container logs).
3. **Run Full Analysis** renders markdown insights via the local proxy.
4. Stop Polaris entirely (or confirm it's down) — the app still works, proving independence.
5. A document that previously stalled at "processing" now completes (or can be re-processed from the Document Detail panel) once the local proxy is reachable.
