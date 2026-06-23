# PRP — Phase 14: LiteLLM Provider Support

## Context

Today the app talks to **Azure OpenAI directly** from the browser. `src/services/aiService.ts` builds an Azure-specific URL (`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`) and authenticates with the `api-key` header. The four Azure settings (`azure_openai_endpoint`, `azure_openai_api_key`, `azure_openai_deployment`, `azure_openai_api_version`) are entered in `src/pages/Settings.tsx`.

Some deployments (e.g. the Polaris stack) front all LLM traffic with a **LiteLLM proxy** — an OpenAI-compatible gateway. The proxy holds the real provider keys; clients only need a base URL, a bearer token, and a public model name. From a client's perspective the only differences vs. the current Azure path are:

- **URL:** `{baseUrl}/chat/completions` (e.g. `http://localhost:4000/v1/chat/completions`) instead of the Azure deployment URL.
- **Auth:** `Authorization: Bearer <key>` instead of `api-key: <key>`.
- **Body:** includes a `model` field (the public model name registered in LiteLLM, e.g. `gpt-5.4`).

This phase adds **LiteLLM (OpenAI-compatible) as a selectable provider** alongside the existing Azure path. Azure remains the default; no existing behavior changes unless the user opts in. The prompts, retry logic, JSON-mode handling, and response parsing are shared across both providers.

> Note: because the app runs in the browser, the LiteLLM proxy must allow cross-origin requests. LiteLLM enables permissive CORS by default, so calls to a `localhost:4000` proxy work out of the box.

---

## New settings keys (no schema change)

`app_settings` is a generic key/value store, so `src/db/schema.ts` does **not** change. Introduce four keys:

| Key | Purpose | Example |
|---|---|---|
| `ai_provider` | `"azure"` (default) or `"litellm"` | `litellm` |
| `litellm_base_url` | OpenAI-compatible base URL (with `/v1`) | `http://localhost:4000/v1` |
| `litellm_api_key` | LiteLLM master/virtual key | `SK-1234` |
| `litellm_model` | Public model name registered in the proxy | `gpt-5.4` |

Add these to the `app_settings` "Keys in use" list in `docs/DATABASE.md`.

---

## Changes: `src/services/aiService.ts`

### 1. Provider + config helpers

```ts
function getProvider(): 'azure' | 'litellm' {
  return getSetting('ai_provider') === 'litellm' ? 'litellm' : 'azure'
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
```

Keep the existing `getAzureConfig()` unchanged.

### 2. Provider-agnostic `callLLM()`

Replace the internal `callAzureOpenAI()` with a single `callLLM()` that branches on the provider but shares the retry/parse logic:

```ts
async function callLLM(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { jsonMode?: boolean; temperature?: number; maxTokens?: number }
): Promise<string> {
  let url: string
  let headers: Record<string, string>
  const body: Record<string, unknown> = {
    messages,
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 4096,
  }
  if (options?.jsonMode) body.response_format = { type: 'json_object' }

  if (getProvider() === 'litellm') {
    const { baseUrl, apiKey, model } = getLiteLLMConfig()
    url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
    headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    body.model = model
  } else {
    const { endpoint, apiKey, deployment, apiVersion } = getAzureConfig()
    url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
    headers = { 'api-key': apiKey, 'Content-Type': 'application/json' }
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 10000))
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (resp.status === 429) { lastError = new Error('Rate limited (429). Retrying…'); continue }
    if (!resp.ok) throw new Error(`LLM error: ${resp.status} ${resp.statusText}`)
    const data = await resp.json() as { choices: { message: { content: string } }[] }
    return data.choices[0].message.content
  }
  throw lastError ?? new Error('LLM request failed after retries')
}
```

### 3. Migrate call sites

- Replace every internal `callAzureOpenAI(...)` reference (in `testConnection`, `classifyDocument`, `extractFinancials`, `extractStrategicPriorities`, `extractSustainability`, `extractKeyFacts`) with `callLLM(...)`.
- Fold `generateInsights()` (which currently has its own inline Azure `fetch`) into `callLLM`:

```ts
export async function generateInsights(institutionName: string, compiledData: string): Promise<string> {
  const userPrompt = `...existing prompt...`
  return callLLM([{ role: 'user', content: userPrompt }], { temperature: 0.4, maxTokens: 2000 })
}
```

---

## Changes: `src/pages/Settings.tsx`

Rename the section to **"AI Provider Configuration"** and add a provider dropdown that toggles which fields show.

```tsx
const [provider, setProvider] = useState<'azure' | 'litellm'>('azure')
const [litellmBaseUrl, setLitellmBaseUrl] = useState('')
const [litellmKey, setLitellmKey] = useState('')
const [litellmModel, setLitellmModel] = useState('')
```

Load in the existing effect:

```tsx
setProvider(getSetting('ai_provider') === 'litellm' ? 'litellm' : 'azure')
setLitellmBaseUrl(getSetting('litellm_base_url') ?? '')
setLitellmKey(getSetting('litellm_api_key') ?? '')
setLitellmModel(getSetting('litellm_model') ?? '')
```

Persist in `saveSettings`:

```tsx
setSetting('ai_provider', provider)
setSetting('litellm_base_url', litellmBaseUrl)
setSetting('litellm_api_key', litellmKey)
setSetting('litellm_model', litellmModel)
```

UI:

- A `<select>` bound to `provider` with options "Azure OpenAI" / "LiteLLM (OpenAI-compatible)".
- When `provider === 'azure'`: render the existing four Azure fields.
- When `provider === 'litellm'`: render **Base URL** (placeholder `http://localhost:4000/v1`), **API Key** (masked, reuse the show/hide eye toggle), and **Model Name** (placeholder `gpt-5.4`).
- The existing **Test Connection** button is unchanged — `testConnection()` now routes through `callLLM` automatically.

---

## Files Modified

| File | Change |
|---|---|
| `src/services/aiService.ts` | Add `getProvider()`, `getLiteLLMConfig()`, provider-agnostic `callLLM()`; migrate all call sites; fold `generateInsights` into `callLLM` |
| `src/pages/Settings.tsx` | Provider dropdown + conditional LiteLLM fields (base URL, key, model); load/save new keys |
| `docs/DATABASE.md` | Document the four new `app_settings` keys |

No changes to `src/db/schema.ts`.

---

## Verification

1. `npm run build` — no TypeScript errors.
2. With provider = **Azure** (default), existing extraction and insights flows behave exactly as before.
3. Switch provider to **LiteLLM**, enter `http://localhost:4000/v1`, key `SK-1234`, model `gpt-5.4`; click **Test Connection** → success toast.
4. Upload and process a document while on LiteLLM → classification + extraction populate the data tabs (request goes to `{baseUrl}/chat/completions` with `Authorization: Bearer …` and a `model` field).
5. Run **Run Full Analysis** on LiteLLM → markdown insights render in the Insights tab.
6. Switching the provider back to Azure restores the Azure-only request shape.
