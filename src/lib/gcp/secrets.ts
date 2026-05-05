// Google Cloud Secret Manager fallback for API keys.
// On Cloud Run we prefer --set-secrets so the secret arrives as an env var,
// but if the env var is missing we lazy-fetch from Secret Manager directly
// using Application Default Credentials (the runtime service account).

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { projectId } from "./env.ts";

let client: SecretManagerServiceClient | null = null;
const cache = new Map<string, string>();

function getClient(): SecretManagerServiceClient {
  if (!client) client = new SecretManagerServiceClient();
  return client;
}

export async function getSecret(name: string): Promise<string | null> {
  if (cache.has(name)) return cache.get(name)!;
  const project = projectId();
  if (!project) return null;
  try {
    const [version] = await getClient().accessSecretVersion({
      name: `projects/${project}/secrets/${name}/versions/latest`,
    });
    const payload = version.payload?.data?.toString();
    if (!payload) return null;
    cache.set(name, payload);
    return payload;
  } catch {
    return null;
  }
}

export async function getAnthropicKey(): Promise<string | null> {
  const env = process.env.ANTHROPIC_API_KEY;
  if (env) return env;
  return getSecret("anthropic-api-key");
}
