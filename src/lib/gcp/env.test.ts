import { test } from "node:test";
import assert from "node:assert/strict";
import { projectId } from "./env.ts";

const ENV_KEYS = ["GOOGLE_CLOUD_PROJECT", "GCP_PROJECT", "GCLOUD_PROJECT"] as const;

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const prior: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) prior[key] = process.env[key];
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  }
}

test("projectId returns null when no env var is set", () => {
  withEnv(
    {
      GOOGLE_CLOUD_PROJECT: undefined,
      GCP_PROJECT: undefined,
      GCLOUD_PROJECT: undefined,
    },
    () => {
      assert.equal(projectId(), null);
    },
  );
});

test("projectId prefers GOOGLE_CLOUD_PROJECT", () => {
  withEnv(
    {
      GOOGLE_CLOUD_PROJECT: "primary",
      GCP_PROJECT: "secondary",
      GCLOUD_PROJECT: "tertiary",
    },
    () => {
      assert.equal(projectId(), "primary");
    },
  );
});

test("projectId falls back to GCP_PROJECT when GOOGLE_CLOUD_PROJECT is missing", () => {
  withEnv(
    {
      GOOGLE_CLOUD_PROJECT: undefined,
      GCP_PROJECT: "secondary",
      GCLOUD_PROJECT: "tertiary",
    },
    () => {
      assert.equal(projectId(), "secondary");
    },
  );
});

test("projectId finally falls back to GCLOUD_PROJECT", () => {
  withEnv(
    {
      GOOGLE_CLOUD_PROJECT: undefined,
      GCP_PROJECT: undefined,
      GCLOUD_PROJECT: "tertiary",
    },
    () => {
      assert.equal(projectId(), "tertiary");
    },
  );
});
