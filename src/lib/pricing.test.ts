import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODELS,
  inputCost,
  outputCost,
  totalCost,
  findModel,
  formatUSD,
} from "./pricing.ts";

test("MODELS includes every major provider", () => {
  const providers = new Set(MODELS.map((m) => m.provider));
  for (const p of ["OpenAI", "Anthropic", "Google", "DeepSeek"]) {
    assert.ok(providers.has(p as never), `expected provider: ${p}`);
  }
});

test("inputCost scales linearly with tokens", () => {
  const m = MODELS.find((x) => x.id === "claude-sonnet-4-6")!;
  const a = inputCost(1_000_000, m);
  const b = inputCost(2_000_000, m);
  assert.ok(Math.abs(b - 2 * a) < 1e-9);
});

test("inputCost uses the per-million rate", () => {
  const m = MODELS.find((x) => x.id === "claude-sonnet-4-6")!;
  const cost = inputCost(1_000_000, m);
  assert.equal(cost, m.inputPerM);
});

test("formatUSD produces readable strings across magnitudes", () => {
  assert.equal(formatUSD(0), "$0");
  assert.match(formatUSD(0.0000005), /^\$\d/);
  assert.match(formatUSD(0.00123), /^\$0\.\d{5}$/);
  assert.match(formatUSD(0.5), /^\$0\.\d{4}$/);
  assert.match(formatUSD(12.34), /^\$12\.34$/);
  assert.match(formatUSD(1234), /^\$1,234$/);
});

test("formatUSD never emits NaN or undefined for known inputs", () => {
  for (const v of [0, 0.0001, 1, 100, 1_000_000]) {
    const s = formatUSD(v);
    assert.ok(!s.includes("NaN") && !s.includes("undefined"));
  }
});

test("outputCost scales linearly with tokens", () => {
  const m = MODELS.find((x) => x.id === "claude-sonnet-4-6")!;
  const a = outputCost(1_000_000, m);
  const b = outputCost(2_500_000, m);
  assert.ok(Math.abs(b - 2.5 * a) < 1e-9);
});

test("totalCost equals input + output", () => {
  const m = MODELS.find((x) => x.id === "gpt-4o")!;
  const i = 1_000;
  const o = 2_000;
  const sum = totalCost(i, o, m);
  assert.ok(Math.abs(sum - (inputCost(i, m) + outputCost(o, m))) < 1e-12);
});

test("findModel returns the model when it exists, undefined otherwise", () => {
  assert.ok(findModel("claude-haiku-4-5"));
  assert.equal(findModel("does-not-exist"), undefined);
});

test("formatUSD handles non-finite inputs without leaking NaN", () => {
  assert.equal(formatUSD(Number.NaN), "$0");
  assert.equal(formatUSD(Number.POSITIVE_INFINITY), "$0");
  assert.equal(formatUSD(Number.NEGATIVE_INFINITY), "$0");
});

test("every MODEL has consistent pricing fields", () => {
  for (const m of MODELS) {
    assert.equal(typeof m.inputPerM, "number");
    assert.equal(typeof m.outputPerM, "number");
    assert.ok(m.outputPerM >= m.inputPerM, `${m.id}: output should be ≥ input`);
    assert.ok(["frontier", "balanced", "fast"].includes(m.tier));
  }
});
