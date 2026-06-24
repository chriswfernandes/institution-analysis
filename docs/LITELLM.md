# Running the self-hosted LiteLLM proxy

The HE Industry Tracker can send all its AI traffic (classification, extraction, insights) through a **LiteLLM** proxy — an OpenAI-compatible gateway that holds the real Azure OpenAI keys, so the browser only needs a base URL, a bearer token, and a model name.

This project runs its **own** LiteLLM proxy, fully independent of the Polaris stack:

- Container `he-tracker-litellm`, image `he-tracker-litellm:latest`, host port **4001** (Polaris keeps 4000). Both can run at once.
- A custom image that trusts the corporate **Netskope** CA chain so outbound HTTPS to Azure works behind TLS inspection.
- A **static** model config in [`litellm/litellm_config.yaml`](../litellm/litellm_config.yaml) — no Postgres, no admin UI; models are ready as soon as the container starts.

---

## 1. One-time setup

1. Copy the env template and fill it in:

```bash
cp .env.litellm.example .env.litellm
```

   Set in `.env.litellm`:
   - `LITELLM_MASTER_KEY` — any value, e.g. `sk-he-tracker-local` (you'll enter this as the API Key in Settings).
   - `AZURE_API_BASE`, `AZURE_API_KEY`, `AZURE_API_VERSION` — your Azure OpenAI resource details.
   - `NETSKOPE_ROOT_CA_B64`, `NETSKOPE_TENANT_CA_B64` — reuse the base64 CA values from the Polaris `.env`. Leave blank when off the corporate network.

2. Set your Azure **deployment name** in [`litellm/litellm_config.yaml`](../litellm/litellm_config.yaml):

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/<your-azure-deployment-name>
```

   The deployment name is not a secret, so it lives in the config; the endpoint/key stay in `.env.litellm`.

---

## 2. Running it

> **Auto-start:** `npm run dev` starts LiteLLM automatically (via `scripts/start-litellm.mjs`) alongside Vite and Docling. The first run builds the `he-tracker-litellm` image (a few minutes); later runs reuse it. Stop an auto-started container with `npm run litellm:stop`.

> **Colima requirement:** this machine has no Docker Desktop — [Colima](https://github.com/abiosoft/colima) provides the Docker daemon. The launcher runs `colima start` automatically if the daemon isn't reachable; you can also start it yourself with `colima start`. Verify with `docker info`.

### Manual fallback

If you'd rather run it by hand (or run only the frontend with `npm run dev:app`):

```bash
# Ensure the daemon is up
colima start

# Build once (CA args read from .env.litellm; omit if off-corporate-network)
docker build -f litellm/litellm.Dockerfile \
  --build-arg NETSKOPE_ROOT_CA_B64="$(grep '^NETSKOPE_ROOT_CA_B64=' .env.litellm | cut -d= -f2-)" \
  --build-arg NETSKOPE_TENANT_CA_B64="$(grep '^NETSKOPE_TENANT_CA_B64=' .env.litellm | cut -d= -f2-)" \
  -t he-tracker-litellm:latest litellm/

# Run on port 4001
docker run --rm --name he-tracker-litellm \
  -p 4001:4000 \
  --env-file .env.litellm \
  -v "$PWD/litellm/litellm_config.yaml:/app/config.yaml:ro" \
  he-tracker-litellm:latest --config /app/config.yaml --port 4000
```

Health check: `curl -s localhost:4001/health`.

---

## 3. Point the app at it

1. In the app, open **Settings → AI Provider Configuration**.
2. Set **Provider** to **LiteLLM (OpenAI-compatible)**.
3. Fill in:
   - **Base URL**: `http://localhost:4001/v1`
   - **API Key**: the `LITELLM_MASTER_KEY` value
   - **Model Name**: `gpt-4o` (must match a `model_name` in `litellm_config.yaml`)
4. Click **Save Settings**, then **Test Connection** — you should see a success toast.

LiteLLM enables permissive CORS by default, so calls from `http://localhost:5173` work out of the box.

---

## Adding more models

Add another entry under `model_list` in `litellm/litellm_config.yaml` (each `model_name` becomes a selectable value in Settings), then restart the container:

```bash
npm run litellm:stop && npm run dev
```

---

## Troubleshooting

- **Document stuck at "processing"** — usually the LLM is unreachable. Confirm `curl -s localhost:4001/health` succeeds and that Settings → Test Connection passes. Re-process the document from its detail panel once the proxy is back.
- **TLS / certificate errors reaching Azure** — the CA build args were empty or wrong. Rebuild with the `NETSKOPE_*_CA_B64` values populated (`npm run litellm:stop`, delete the image with `docker rmi he-tracker-litellm:latest`, then `npm run dev`).
- **`.env.litellm missing` warning** — copy `.env.litellm.example` to `.env.litellm` and fill it in.
- **`400 ... model not found`** — the **Model Name** in Settings doesn't match any `model_name` in `litellm_config.yaml`.
- **Port 4001 already in use** — another LiteLLM is already there; the launcher will use it. Stop it (`npm run litellm:stop`) if you want a fresh container.
- **This is not Polaris** — this proxy is independent (port 4001 vs Polaris's 4000). You do not need the Polaris stack running.
