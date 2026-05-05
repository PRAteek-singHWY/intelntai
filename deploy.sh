#!/usr/bin/env bash
# One-shot Google Cloud Run deploy for Tokenly.
#
# Prereqs (one-time):
#   1. brew install --cask google-cloud-sdk
#   2. gcloud auth login
#   3. gcloud config set project <YOUR_PROJECT_ID>
#   4. gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
#        artifactregistry.googleapis.com aiplatform.googleapis.com \
#        firestore.googleapis.com secretmanager.googleapis.com \
#        logging.googleapis.com
#   5. (optional, recommended) Store the Anthropic key in Secret Manager:
#        printf '%s' "$ANTHROPIC_API_KEY" | gcloud secrets create anthropic-api-key \
#          --replication-policy=automatic --data-file=-
#      Or update an existing version:
#        printf '%s' "$ANTHROPIC_API_KEY" | gcloud secrets versions add \
#          anthropic-api-key --data-file=-
#
# Then run:  ./deploy.sh
#
# The Cloud Run service account needs:
#   - roles/secretmanager.secretAccessor      (read API keys)
#   - roles/datastore.user                    (read/write Firestore)
#   - roles/aiplatform.user                   (call Vertex AI Gemini)
#   - roles/logging.logWriter                 (Cloud Logging writes)

set -euo pipefail

SERVICE="${SERVICE:-tokenly}"
REGION="${REGION:-asia-south1}"
ALLOW_UNAUTH="${ALLOW_UNAUTH:-true}"
USE_SECRET_MANAGER="${USE_SECRET_MANAGER:-auto}"
VERTEX_LOCATION="${VERTEX_LOCATION:-us-central1}"

PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
  echo "❌  No gcloud project set. Run: gcloud config set project <YOUR_PROJECT_ID>" >&2
  exit 1
fi

echo "▶ Deploying $SERVICE to Cloud Run · project=$PROJECT region=$REGION"

# ── Resolve how to inject the Anthropic key ────────────────────────────────
# Priority:
#   1. USE_SECRET_MANAGER=true → bind --set-secrets unconditionally
#   2. USE_SECRET_MANAGER=auto → use Secret Manager if the secret exists
#   3. Fall back to the $ANTHROPIC_API_KEY env var (--set-env-vars)
SECRET_EXISTS=false
if gcloud secrets describe anthropic-api-key --project="$PROJECT" >/dev/null 2>&1; then
  SECRET_EXISTS=true
fi

ENV_ARGS=()
SECRET_ARGS=()
if [[ "$USE_SECRET_MANAGER" == "true" || ( "$USE_SECRET_MANAGER" == "auto" && "$SECRET_EXISTS" == "true" ) ]]; then
  echo "▶ Binding ANTHROPIC_API_KEY from Secret Manager (anthropic-api-key:latest)"
  SECRET_ARGS=(--set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest")
elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "▶ Injecting ANTHROPIC_API_KEY from local env (consider Secret Manager)"
  ENV_ARGS=(--set-env-vars "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}")
else
  echo "ℹ  No ANTHROPIC_API_KEY env var or Secret Manager secret found — only rules-based + Gemini will work"
fi

# ── Always-on env: Google Cloud project, Vertex region, Cloud Logging on ───
COMMON_ENV=(
  "GOOGLE_CLOUD_PROJECT=${PROJECT}"
  "VERTEX_LOCATION=${VERTEX_LOCATION}"
  "CLOUD_LOGGING_ENABLED=1"
)
COMMON_ENV_FLAG=("--set-env-vars" "$(IFS=,; echo "${COMMON_ENV[*]}")")
# Merge with --set-env-vars from ENV_ARGS if present.
if [[ ${#ENV_ARGS[@]} -gt 0 ]]; then
  COMBINED="$(IFS=,; echo "${COMMON_ENV[*]}"),${ENV_ARGS[1]}"
  COMMON_ENV_FLAG=("--set-env-vars" "$COMBINED")
  ENV_ARGS=()
fi

AUTH_FLAG="--no-allow-unauthenticated"
if [[ "$ALLOW_UNAUTH" == "true" ]]; then
  AUTH_FLAG="--allow-unauthenticated"
fi

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 60 \
  --max-instances 10 \
  "$AUTH_FLAG" \
  "${COMMON_ENV_FLAG[@]}" \
  ${SECRET_ARGS[@]+"${SECRET_ARGS[@]}"}

echo
echo "✅  Deployed. Public URL:"
gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --format='value(status.url)'
