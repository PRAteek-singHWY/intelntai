# Tokenly — Make every token count

Compress prompts. Visualize token waste. Compare model cost across every major
LLM. Cut your AI bill by 40%+ without losing intent.

> **Submission for**: PromptWars × Google × Scaler — *Intelligent Token & Cost
> Optimization for LLMs*

---

## Chosen vertical

**Intelligent Token & Cost Optimization for LLMs.**

The problem statement names seven possible angles (compression, cost
dashboard, context manager, model comparison, system-prompt optimizer,
context-window visualizer, prompt debugger). Tokenly tackles **four of them in
one product**, because real teams need every layer of the prompt pipeline
optimized — not just one:

| Tool | Vertical solved |
| --- | --- |
| **Compressor** | Prompt compression engine — strips bloat, preserves intent |
| **Context Pruner** | Smart context manager — drops noisy RAG chunks |
| **Influence Map** | Prompt debugger — heatmap of which tokens move the model |
| **Model Arena** | Model comparison + cost dashboard — finds cost/quality sweet spot |

The persona this is built for: an AI/platform engineer who runs production
LLM workloads and is paying for tokens that don't move the model. They need
quantified, drop-in answers — not another notebook.

---

## Approach and logic

### The thesis

Up to 40% of tokens in production prompts add no semantic value. They fall
into a small set of categories: verbose phrasing, filler words, politeness,
meta-instructions, duplicates, whitespace. These are deterministically
detectable. The remaining waste is RAG noise (retrieved chunks that don't
actually answer the question) and model misallocation (Opus running tasks
Haiku could handle).

### The solution stack

```
                ┌──────────────────────────────────────────┐
   user prompt ─▶  Compressor  ──▶ rules engine + Claude   │
                │                  + Gemini (Vertex AI)    │
                │  Context Pruner ─▶ relevance scoring     │
                │  Influence Map  ─▶ per-token attribution │
                │  Model Arena    ─▶ value optimizer       │
                └──────────────────────────────────────────┘
                          │
                          ▼
              metrics + Firestore + Cloud Logging
```

### Logic per tool

**Compressor** — A two-pass design:

1. *Rules pass*: 26 regex patterns categorized by waste type. Each match
   produces a `Segment` with `kind` (kept/removed/rewritten), category, and
   human reason. The UI renders this as a token-level diff.
2. *AI pass* (optional): same prompt sent to Claude Sonnet 4.6 *and* Gemini
   2.5 Flash via Vertex AI, with a strict-JSON system prompt enforcing
   semantic preservation. The route caches identical inputs (24 h LRU) so
   repeat compressions don't burn tokens.

**Context Pruner** — heuristic relevance scorer that needs no embeddings:

```
score = (Jaccard coverage × 0.7)
      + (TF weighting    × 0.5, capped)
      + signal bonus (numbers, entities, code)
      − length penalty (long off-topic chunks)
```

Returns 0–1 per chunk. Adjustable threshold lets ops trade aggressiveness
for recall.

**Influence Map** — heuristic per-token attribution. Each word is bucketed:

- *high*: instruction verbs (`must`/`always`/`never`), numbers, code tokens, named entities, content terms ≥ 8 chars
- *low*: politeness, fillers, stopwords
- *med*: everything else

Encoded across **three channels** (color, weight, underline) so the heatmap
remains readable for color-blind users.

**Model Arena** — live cost comparison across nine models with a
sweet-spot picker:

```
value = (quality × 0.6 + speed × 0.4) ÷ cost-per-call
       × suitability(prompt-complexity)
```

Filtered by per-call budget. Prompt complexity is itself derived from the
Influence Map output — so a high-signal prompt biases toward frontier
models, a chatty one biases toward fast ones.

---

## How it works

### Request flow

1. Browser POSTs `{prompt, mode}` to `/api/compress`
2. Per-IP rate limit (token bucket, 20/min)
3. Body validation: required prompt, ≤50k chars, mode ∈ {rules, ai, gemini, both, all}
4. `compressRuleBased` runs deterministically and always returns
5. Mode dispatches optional engines:
   - `ai` → Claude (Anthropic SDK), with daily USD spend cap
   - `gemini` → Vertex AI Gemini, ADC-authenticated on Cloud Run
   - `all` → both, side-by-side
6. Identical prompts hit the in-memory LRU cache (no token spend)
7. Async fire-and-forget: write a record to Firestore for analytics
8. Structured JSON line written to Cloud Logging

### Tools

```bash
pnpm install
cp .env.local.example .env.local   # then edit with your keys
pnpm dev                           # http://localhost:3000
pnpm test                          # 130 unit + integration tests
pnpm test:coverage                 # coverage report
pnpm typecheck                     # tsc --noEmit
pnpm build                         # production build
./deploy.sh                        # one-shot Cloud Run deploy
```

### Tests

130 tests using Node's built-in test runner with experimental TS stripping
(Node 22.6+ — no Jest, no Vitest, zero test deps in `package.json`):

| Module | Coverage |
| --- | --- |
| `pricing.ts`, `tokenizer.ts`, `validation.ts`, `rate-limit.ts`, `relevance.ts`, `prompts.ts`, `gcp/env.ts` | 100% line |
| `influence.ts`, `compress.ts`, `compress-handler.ts` | 96–99% line |
| `cache.ts`, `spend-cap.ts` | 91–93% line |
| `log.ts`, `gcp/*` (mockable surfaces only) | 35–72% — remainder requires live GCP creds |

Overall: **78.66% line / 86.89% branch** across the lib layer.

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

### Architecture

```
Browser ──► Cloud Run (Next.js) ──┬──► Anthropic API (Claude)
                                  ├──► Vertex AI (Gemini)
                                  ├──► Firestore (history)
                                  ├──► Secret Manager (keys)
                                  └──► Cloud Logging (events)
```

---

## Local development

```bash
pnpm install
cp .env.local.example .env.local
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

## Deploy

```bash
./deploy.sh
```

Deploys to Cloud Run via Cloud Build. The script:

1. Detects whether `anthropic-api-key` exists in Secret Manager and binds it
   via `--set-secrets`, or falls back to a local env var.
2. Sets `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION`, and
   `CLOUD_LOGGING_ENABLED=1` on the revision.
3. Prints the public URL.

The Cloud Run runtime service account needs:

- `roles/secretmanager.secretAccessor`
- `roles/datastore.user`
- `roles/aiplatform.user`
- `roles/logging.logWriter`

---

## Security

| Concern | Mitigation |
| --- | --- |
| Secrets in repo | `.env*` is git-ignored; production keys live in Secret Manager |
| Key exfiltration | Cloud Run binds the key via `--set-secrets` — never written to image |
| Untrusted input | Body validation: type, length ≤50k, mode allow-list |
| Cost runaway | Per-IP rate limit (20/min) + daily USD cap on Anthropic spend |
| Log injection | All log fields go through `JSON.stringify` — no string interpolation |
| Prompt-history PII | Only first 200 chars stored in Firestore as `promptPreview` |
| XSS in rendered prompts | All user content rendered via React text nodes — no `dangerouslySetInnerHTML` |

---

## Accessibility

- Skip link to `#main` (visible on focus)
- Every form control has a visible `<label htmlFor>`
- All sliders have `aria-valuemin`/`max`/`now`/`text`
- Tabs wired with `role=tablist`/`tab`/`tabpanel`, full keyboard arrow nav
- Heatmap encodes signal across **three channels** (color, weight, underline) for color-blind support
- All decorative icons marked `aria-hidden="true"`
- Tables include `<caption>` and `aria-labelledby`
- All interactive elements have `focus-visible` rings
- `aria-pressed` / `aria-expanded` / `aria-busy` on toggle and async controls
- `aria-live` regions on cost-savings updates

---

## Assumptions made

These are the design and operational assumptions baked into the build:

1. **Cl100k tokenizer is a "good enough" cross-model proxy.** We use
   `gpt-tokenizer` (cl100k base) for everything and apply a small per-provider
   scalar (`approxTokens`). For exact billing-grade Anthropic/Google counts a
   real provider tokenizer would be needed, but cross-model deltas are
   stable enough for cost-savings demos.

2. **Public list pricing is acceptable for "before/after" math.** Enterprise
   contracts and commitments aren't modeled. The numbers shown are *list
   rates*, used to illustrate relative savings, not produce invoices.

3. **In-memory cache and rate limiter are per Cloud Run instance.** This is
   fine at hackathon scale and behind a single-region deployment. For
   horizontal scale this would move to a shared store (Memorystore / Upstash
   Redis); the API surface (`cacheGet`/`cacheSet`/`rateLimit`) is already
   abstracted to make that swap a one-file change.

4. **The relevance scorer doesn't require embeddings.** This is a deliberate
   simplifying assumption — heuristic overlap+TF+signal scoring runs in
   microseconds, has zero infra dependencies, and is *good enough* to
   demonstrate the savings shape. Embedding-based scoring is a drop-in
   replacement (same `scoreChunks` signature) when production accuracy
   demands it.

5. **The influence-attribution heatmap is a heuristic, not logprob-based.**
   Real attention rollout / logprob-based attribution requires raw model
   internals that none of the public APIs expose. The heuristic uses
   instruction-verb dictionaries, entity heuristics, and length signals to
   approximate the same intuition.

6. **Daily spend cap is approximate.** It tallies tokens billed against the
   Sonnet 4.6 list rate. If a different Claude model is wired in, the cap
   stays directionally correct but is no longer exact — fine for a demo
   ceiling, not for accounting.

7. **Firestore writes are best-effort and structured.** A failed Firestore
   write logs an error (severity ERROR with code/details/message) but does
   *not* fail the user request. Observability shouldn't add latency to the
   user path.

8. **Single-region deployment is sufficient for the demo.** Multi-region
   consistency, cross-region failover, and CDN caching are out of scope.

9. **All secrets live in Secret Manager.** No production secret ever appears
   in the repo, in a build log, or in `.env` committed to source control.
   The `deploy.sh` script will prefer a `--set-secrets` binding over a local
   env var when the secret exists.

---

## Submission checklist

- [x] Public GitHub repo — single `main` branch
- [x] Tracked size well under 10 MB (~440 KB)
- [x] Chosen vertical stated explicitly
- [x] Approach and logic documented
- [x] How it works documented
- [x] Assumptions stated
- [x] Tests pass (`pnpm test` — 130 / 130)
- [x] Coverage > 75% across the lib layer
- [x] TypeScript strict — `pnpm typecheck` clean
- [x] All inputs validated, rate-limited, and budget-capped
- [x] Six distinct Google Cloud services integrated end-to-end
- [x] Accessible: skip link, ARIA, keyboard nav, focus rings, multi-channel heatmap
