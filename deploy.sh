#!/usr/bin/env bash
# One-shot Google Cloud Run deploy for Tokenly.
#
# Prereqs (one-time):
#   1. brew install --cask google-cloud-sdk    # or download from cloud.google.com/sdk
#   2. gcloud auth login
#   3. gcloud config set project <YOUR_PROJECT_ID>
#   4. gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
#
# Then run:  ./deploy.sh
#
# Optional: set ANTHROPIC_API_KEY in your shell to enable AI deep-rewrite mode.

set -euo pipefail

SERVICE="${SERVICE:-tokenly}"
REGION="${REGION:-asia-south1}"
ALLOW_UNAUTH="${ALLOW_UNAUTH:-true}"

PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
  echo "❌  No gcloud project set. Run: gcloud config set project <YOUR_PROJECT_ID>" >&2
  exit 1
fi

echo "▶ Deploying $SERVICE to Cloud Run · project=$PROJECT region=$REGION"

ENV_ARGS=()
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  ENV_ARGS=(--set-env-vars "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}")
  echo "▶ ANTHROPIC_API_KEY found — AI deep-compression mode will be enabled"
else
  echo "ℹ  ANTHROPIC_API_KEY not set — only rules-based compression will run on Cloud Run"
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
  ${ENV_ARGS[@]+"${ENV_ARGS[@]}"}

echo
echo "✅  Deployed. Public URL:"
gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --format='value(status.url)'
