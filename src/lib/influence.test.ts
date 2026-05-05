import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreInfluence } from "./influence.ts";

test("instruction verbs score high", () => {
  const r = scoreInfluence("You must summarize this carefully.");
  const must = r.words.find((w) => w.word.toLowerCase() === "must");
  assert.ok(must);
  assert.equal(must!.bucket, "high");
});

test("politeness and filler score low", () => {
  const r = scoreInfluence("Please kindly help me with this very simple task.");
  const please = r.words.find((w) => w.word.toLowerCase() === "please");
  assert.ok(please);
  assert.equal(please!.bucket, "low");
});

test("numbers always score high", () => {
  const r = scoreInfluence("The deadline is 2026-04-12 and budget is 500.");
  const numbers = r.words.filter((w) => /^\d/.test(w.word));
  assert.ok(numbers.length > 0);
  for (const n of numbers) assert.equal(n.bucket, "high");
});

test("empty input returns zero average", () => {
  const r = scoreInfluence("");
  assert.equal(r.averageScore, 0);
  assert.equal(r.highCount, 0);
  assert.equal(r.lowCount, 0);
});

test("highCount + lowCount tracks bucket assignments", () => {
  const r = scoreInfluence("Please summarize. Always cite sources.");
  assert.ok(r.highCount > 0);
  assert.ok(r.lowCount > 0);
});
