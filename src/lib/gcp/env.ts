// Shared GCP env helpers. Cloud Run and gcloud both populate one of these,
// but which one varies by tool — read all three with the same precedence
// everywhere so the modules stay in sync.

export function projectId(): string | null {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    null
  );
}
