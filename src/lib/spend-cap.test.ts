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

test("spendRemaining is non-negative even after large spend", () => {
  // Force a huge spend; remaining should clamp to 0, not go negative.
  recordSpend(50_000_000, 50_000_000);
  assert.ok(spendRemaining() >= 0);
});

test("spendStats day field matches today's UTC date", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(spendStats().day, today);
});

test("spendAllowed flips false once the cap is exceeded", () => {
  // Continue from the prior test — usdSpent should already be over the cap.
  // Add more just in case the env override pushed the cap up.
  recordSpend(50_000_000, 50_000_000);
  assert.equal(spendAllowed(), false);
});
