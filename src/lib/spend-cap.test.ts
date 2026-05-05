import { test } from "node:test";
import assert from "node:assert/strict";
import {
  spendAllowed,
  recordSpend,
  spendStats,
  spendRemaining,
} from "./spend-cap.ts";

test("spendAllowed is true on a fresh module load", () => {
  // Module-scoped state — at import time spend is 0 and cap is the default.
  // (This test runs first because Node's test runner orders in declaration.)
  assert.equal(spendAllowed(), true);
  assert.ok(spendRemaining() > 0);
});

test("recordSpend accumulates USD against the cap", () => {
  const before = spendStats().usdSpent;
  // 1M input + 1M output tokens at Sonnet pricing = ~$18 per call.
  recordSpend(100_000, 100_000);
  const after = spendStats().usdSpent;
  assert.ok(after > before);
});

test("spendStats reports the configured cap", () => {
  const stats = spendStats();
  assert.equal(typeof stats.capUsd, "number");
  assert.equal(typeof stats.day, "string");
  assert.match(stats.day, /^\d{4}-\d{2}-\d{2}$/);
});
