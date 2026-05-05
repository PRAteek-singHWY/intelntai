import { test } from "node:test";
import assert from "node:assert/strict";

const ENV_KEYS = [
  "GOOGLE_CLOUD_PROJECT",
  "GCP_PROJECT",
  "GCLOUD_PROJECT",
  "GEMINI_API_KEY",
  "VERTEX_LOCATION",
  "GEMINI_MODEL",
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

async function loadModule(suffix: string) {
  return import(`./gemini.ts?case=${suffix}`);
}

test("geminiAvailable returns false when no project and no API key", async () => {
  clearEnv();
  const mod = await loadModule("not-available");
  assert.equal(mod.geminiAvailable(), false);
});

test("geminiAvailable returns true when GOOGLE_CLOUD_PROJECT is set", async () => {
  clearEnv();
  process.env.GOOGLE_CLOUD_PROJECT = "demo-project";
  try {
    const mod = await loadModule("project-set");
    assert.equal(mod.geminiAvailable(), true);
  } finally {
    clearEnv();
  }
});

test("geminiAvailable returns true when GEMINI_API_KEY is set (no project)", async () => {
  clearEnv();
  process.env.GEMINI_API_KEY = "ai-studio-key";
  try {
    const mod = await loadModule("apikey-set");
    assert.equal(mod.geminiAvailable(), true);
  } finally {
    clearEnv();
  }
});
