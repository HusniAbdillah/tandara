# Real model inference: Vikey and DeepSeek

Tandara's triage and Asisten Posko use server-side provider profiles. The full AI
software includes durable LangGraph workflows, approved knowledge retrieval,
briefings, draft assistance, translation review, budget controls and model release
governance. All generated results require human review. The running installation
remains a local simulation until the [production launch gates](readiness.md) close.

## Environment configuration

The ignored root `.env` holds local credentials. `.env.example` has matching
placeholders and contains no real API key. Never use `VITE_` variables for these
settings, commit `.env`, or share it in logs/screenshots.

```dotenv
AI_MODE=heuristic
AI_PROVIDER=vikey
AI_BASE_URL=
AI_MODEL=replace-with-model-id
AI_API_KEY=replace-with-api-key
AI_TIMEOUT_MS=30000
AI_MAX_OUTPUT_TOKENS=2048
```

Replace `AI_MODEL` with an exact model ID from the provider's catalog and
`AI_API_KEY` with your server credential. Then set `AI_MODE=compatible`.
Heuristic mode continues to run without credentials and never calls a model.
Compatible mode rejects empty or obvious placeholder credentials at startup.

| Provider                | Setting                | Default base URL                |
| ----------------------- | ---------------------- | ------------------------------- |
| Temporary Vikey         | `AI_PROVIDER=vikey`    | `https://api.vikey.ai/v1`       |
| Direct DeepSeek         | `AI_PROVIDER=deepseek` | `https://api.deepseek.com`      |
| Approved custom backend | `AI_PROVIDER=custom`   | Explicit `AI_BASE_URL` required |

Named providers resolve their endpoint when `AI_BASE_URL` is empty. Overrides must
match that provider's documented base URL, preventing accidental submission of
its key to another host. Custom endpoints require HTTPS except approved local
HTTP hosts: localhost, loopback IPv4/IPv6, or Docker service `ollama`.
Credentials, query parameters, fragments and full chat-completion paths are
rejected in base URLs. Transport does not follow redirects.

Vikey documents model discovery through `/v1/models` and compatible chat completions.
Select a model that supports JSON output. [Vikey documentation](https://docs.vikey.ai/).
DeepSeek documents JSON mode; output is still validated locally. DeepSeek's
profile explicitly disables thinking for bounded report triage.
[DeepSeek JSON mode](https://api-docs.deepseek.com/guides/json_mode/),
[chat completion API](https://api-docs.deepseek.com/api/create-chat-completion/).

## Apply and verify

For an existing stack using this version of the image, recreate containers rather
than only restarting them: Docker reads changed environment values during creation.

```powershell
docker compose up -d --force-recreate api worker
```

When updating application code, rebuild first:

```powershell
docker compose up --build -d --wait
```

From the repository, `pnpm ai:verify` builds the server packages and makes one
synthetic chat request plus document/query embedding requests when enabled, using `.env`.
These calls can incur provider charges and are bounded by the configured per-run cap.
It validates schema, evidence, source references and human-review flags, and
prints provider/model/dimension/timing metadata only. It does not store a report or publish content.
It fails locally without a network request when mode or placeholders are invalid.

To exercise the complete workflow, submit a clearly labelled simulation report in
Warga, open it in Posko, and inspect Asisten triase. The suggestion records the
actual gateway/provider, requested model, prompt version and duration. Reviewing
a suggestion does not verify or publish the report automatically.

## Failure behavior and limits

Timeout is bounded to 1–90 seconds and output limit to 256–8192 tokens. The default
is 30 seconds and 2048 tokens. Requests use non-streaming JSON mode with explicit
instructions and an example. Empty/refused/truncated output, schema violations,
fabricated quotations or source IDs, and detected prohibited safety claims are
rejected; JSON validity alone does not establish truth.

Transient transport failures and HTTP 408/429/500/502/503/504 are retried by the
SQL outbox, up to four triage attempts in simulation and three in production or
assistance workflows. Provider `Retry-After` is respected up to
five minutes. Authentication, configuration, credit rejection and invalid output
fail without automatic retry. Failed jobs and suggestions contain sanitized
errors, never provider response text or keys. Admin manual retry is audited and
retains earlier failed suggestions in history.

Completed jobs skip another provider request on replay. This prevents ordinary
replay charges and duplicate persisted suggestions; a crash between a provider
response and database commit can still repeat a paid external call. Spatial
duplicate hints run even if model inference is disabled or unavailable.

Dedicated contacts, photographs, session/receipt secrets and exact coordinates
are excluded from model requests. Free-form report text can itself contain personal
information: use synthetic reports until provider data handling is approved.
The gateway redacts recognizable contacts and quarantines identity-related text;
this is not complete personal-data detection. Approved retrieval, LangGraph,
budgets, immutable reviews and release controls are implemented. See the
[operating runbook](operations.md) for deployment and release procedures.

## Switch to DeepSeek later

Change `AI_PROVIDER` to `deepseek`, replace the key and model ID, and clear any old
Vikey `AI_BASE_URL` override. Run synthetic verification and quality evaluation,
then recreate API/worker containers. A provider change applies to subsequent jobs;
existing suggestions retain their recorded provider/model and human decisions.
Do not assume a model served through a gateway is equivalent to the direct service.
Generation and embeddings have independent provider/model/key settings. Changing
generation provider, endpoint, prices, prompt, output limit or embedding profile
creates a new release manifest. Production needs a matching evaluated release and
two independent approvals; in-flight runs with incompatible configuration fail
closed. Existing outputs retain their provenance. DeepSeek generation does not
imply an embeddings endpoint is available: retain an independently approved
embedding provider or use lexical retrieval.

## Embeddings and operational settings

```dotenv
AI_EMBEDDING_MODE=disabled
AI_EMBEDDING_PROVIDER=gemini
AI_EMBEDDING_BASE_URL=
AI_EMBEDDING_MODEL=gemini-embedding-001
AI_EMBEDDING_API_KEY=replace-with-gemini-api-key
AI_EMBEDDING_DIMENSIONS=1536
```

For Google AI Studio/Gemini, set `AI_EMBEDDING_PROVIDER=gemini` and use a separate
Google key in `AI_EMBEDDING_API_KEY`. Keep the Vikey key in `AI_API_KEY`.
After filling the keys, set both modes to `compatible`. Blank embedding base URL
resolves to Google's fixed `https://generativelanguage.googleapis.com/v1beta`;
the adapter uses native `embedContent` with `x-goog-api-key`, not Vikey's endpoint.
The key never enters a URL or browser bundle.

The configured text model is `gemini-embedding-001`. Document ingestion uses
`RETRIEVAL_DOCUMENT`; questions use `RETRIEVAL_QUERY`. The app requests 1,536
dimensions explicitly and normalizes the returned vectors. `gemini-embedding-2`
is also supported with Google's asymmetric retrieval prefixes and no `taskType`.
Dimensions must be 128–3,072; the model, dimensions and task/normalization protocol
are versioned so old vectors cannot mix with a changed profile. A provider change
requires a complete source-version reindex. Google usage is recorded when supplied;
otherwise it remains labelled estimated.
[Google embedding guide](https://ai.google.dev/gemini-api/docs/embeddings),
[native embedding API](https://ai.google.dev/api/embeddings).

Enable compatible embeddings only with a supported model, exact dimension and
reviewed processing policy. Until then, approved-content search uses PostgreSQL
lexical ranking. Internal assistance combines lexical and exact scoped pgvector
ranking when an entire source version has compatible embeddings. Public resident
search never calls a paid model. Reindexing keeps old and partial vectors out of
semantic ranking; source withdrawal and expiry apply before ranking.

The example files also contain per-run, organization, global daily and monthly
funding caps, concurrency limits and price settings in micro USD. Prices are
illustrative placeholders, not provider quotations. Set reviewed upper-bound
prices and funded caps before activation. Admission reserves the full bounded
attempt exposure, including byte expansion for multilingual/JSON input. Actual
reported usage is recorded separately; unreported usage is labelled estimated.
Reservations remain charged against admission caps after completion or retention
to avoid overspending through uncertain billing or deleted history.

`.env.production.example` additionally requires verified database TLS, secure
sessions, two exact HTTPS web origins, an MFA encryption key and independently
approved data processing. It starts with paid inference disabled. Model and
embedding keys stay on the server; no client bundle receives them.
