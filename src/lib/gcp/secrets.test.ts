import { test } from "node:test";
import assert from "node:assert/strict";

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "GOOGLE_CLOUD_PROJECT",
  "GCP_PROJECT",
  "GCLOUD_PROJECT",
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

async function loadModule(suffix: string) {
  return import(`./secrets.ts?case=${suffix}`);
}

test("getAnthropicKey returns the env var verbatim when set", async () => {
  clearEnv();
  process.env.ANTHROPIC_API_KEY = "sk-test-12345";
  try {
    const mod = await loadModule("env-set");
    const key = await mod.getAnthropicKey();
    assert.equal(key, "sk-test-12345");
  } finally {
    clearEnv();
  }
});

test("getAnthropicKey returns null when env is empty and no project is set", async () => {
  clearEnv();
  const mod = await loadModule("no-env-no-project");
  const key = await mod.getAnthropicKey();
  assert.equal(key, null);
});

test("getSecret returns null when no project is configured", async () => {
  clearEnv();
  const mod = await loadModule("getsecret-no-project");
  const v = await mod.getSecret("anthropic-api-key");
  assert.equal(v, null);
});
