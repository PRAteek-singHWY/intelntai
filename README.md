# Tokenly — Make every token count

Compress prompts. Visualize token waste. Compare model cost across every major
LLM. Cut your AI bill by 40%+ without losing intent.

Tokenly is a four-tool prompt-optimization suite:

- **Compressor** — deterministic rules + AI-driven rewrite (Claude *or* Gemini)
- **Context Pruner** — RAG relevance scoring to drop noisy chunks before they cost tokens
- **Influence Map** — heatmap of which words actually move the model
- **Model Arena** — sweet-spot finder across cost / speed / quality

---

## Google Cloud stack

Tokenly is built around Google Cloud and runs entirely on managed services:

| Service | Purpose |
| --- | --- |
| **Cloud Run**      | Hosts the Next.js app via container; auto-scales to zero |
| **Cloud Build**    | Source-to-container build (`gcloud run deploy --source .`) |
| **Vertex AI**      | Gemini 2.5 Flash powers the AI compression path (`@google/genai`) |
| **Firestore**      | Append-only prompt-history collection — fire-and-forget writes |
| **Secret Manager** | Stores `anthropic-api-key`; bound into Cloud Run via `--set-secrets` |
| **Cloud Logging**  | Structured JSON logs (`@google-cloud/logging`) — severity, event, ip |
| **Application Default Credentials** | Vertex AI + Firestore + Secret Manager auth on Cloud Run |

Every Google integration in `src/lib/gcp/*` degrades gracefully when run
locally without ADC — the app still works with rules-based compression.

---

## Local development

```bash
pnpm install
cp .env.local.example .env.local   # then edit with your keys
pnpm dev
```

`.env.local` recognises:

| Variable | Effect |
| --- | --- |
| `ANTHROPIC_API_KEY`         | Enables Claude Sonnet 4.6 compression |
| `GEMINI_API_KEY`            | Enables Gemini via Google AI Studio (no GCP needed) |
| `GOOGLE_CLOUD_PROJECT`      | Enables Vertex AI / Firestore / Secret Manager via ADC |
| `VERTEX_LOCATION`           | Vertex region (default `us-central1`) |
| `FIRESTORE_DATABASE_ID`     | Firestore database name (default `(default)`) |
| `CLOUD_LOGGING_ENABLED=1`   | Mirror logs to Cloud Logging |
| `TOKENLY_DAILY_USD_CAP`     | Daily Anthropic spend ceiling (default `$10`) |

---

## Tests

```bash
pnpm test
```

Covers `compress`, `relevance`, `influence`, `pricing`, `tokenizer`, `cache`,
`rate-limit`, `spend-cap`, and `log` — 40+ unit tests using Node's built-in
test runner with experimental TypeScript stripping (Node 22.6+).

---

## Deploy

```bash
./deploy.sh
```

Deploys to Cloud Run via Cloud Build. The script:

1. Detects whether `anthropic-api-key` exists in Secret Manager and binds it via `--set-secrets`, or falls back to a local env var.
2. Sets `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION`, and `CLOUD_LOGGING_ENABLED=1` on the revision.
3. Prints the public URL.

The Cloud Run runtime service account needs:
- `roles/secretmanager.secretAccessor`
- `roles/datastore.user`
- `roles/aiplatform.user`
- `roles/logging.logWriter`

---

## Architecture

```
Browser ──► Cloud Run (Next.js) ──┬──► Anthropic API (Claude)
                                  ├──► Vertex AI (Gemini)
                                  ├──► Firestore (history)
                                  ├──► Secret Manager (keys)
                                  └──► Cloud Logging (events)
```
