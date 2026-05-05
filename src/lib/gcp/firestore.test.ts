import { test } from "node:test";
import assert from "node:assert/strict";

const ENV_KEYS = [
  "GOOGLE_CLOUD_PROJECT",
  "GCP_PROJECT",
  "GCLOUD_PROJECT",
  "FIRESTORE_DATABASE_ID",
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function silenceConsole<T>(fn: () => Promise<T>): Promise<T> {
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  return fn().finally(() => {
    console.log = origLog;
    console.error = origErr;
  });
}

// Each test gets a fresh module instance (cache-busted via query suffix)
// so the module-level disabled/db state doesn't leak across tests.
async function loadModule(suffix: string) {
  return import(`./firestore.ts?case=${suffix}`);
}

test("logCompression is a no-op when no project is configured", async () => {
  clearEnv();
  const mod = await loadModule("no-project-log");
  await silenceConsole(async () => {
    await mod.logCompression({
      ip: "1.2.3.4",
      mode: "rules",
      promptPreview: "hello",
      promptChars: 5,
      tokensBefore: 10,
      tokensAfter: 4,
      pctSaved: 60,
      cache: "n/a",
    });
  });
  assert.equal(mod.firestoreAvailable(), false);
});

test("recentCompressions returns [] when no project is configured", async () => {
  clearEnv();
  const mod = await loadModule("no-project-recent");
  const out = await mod.recentCompressions(5);
  assert.deepEqual(out, []);
});

test("firestoreAvailable is false in a no-credentials environment", async () => {
  clearEnv();
  const mod = await loadModule("availability");
  assert.equal(mod.firestoreAvailable(), false);
});
