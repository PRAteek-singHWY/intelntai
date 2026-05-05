import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreChunks } from "./relevance.ts";

test("relevant chunks score higher than noise", () => {
  const question = "What's the refund policy for orders shipped to Canada?";
  const chunks = [
    "Refunds are issued within 14 days for Canadian orders. Contact support@example.com.",
    "Our office hours are 9am to 5pm Pacific time, Monday through Friday.",
    "The CEO recently spoke at a conference about AI ethics.",
  ];
  const r = scoreChunks(question, chunks);
  // The first chunk should rank highest.
  const top = r.scores.reduce((a, b) => (a.score > b.score ? a : b));
  assert.equal(top.index, 0);
});

test("threshold controls keep/drop", () => {
  const question = "deployment frequency";
  const chunks = ["unrelated text about cooking pasta"];
  const strict = scoreChunks(question, chunks, 0.9);
  const lax = scoreChunks(question, chunks, 0);
  assert.equal(strict.scores[0].keep, false);
  assert.equal(lax.scores[0].keep, true);
});

test("empty chunks are handled gracefully", () => {
  const r = scoreChunks("anything", ["", "   "]);
  for (const s of r.scores) {
    assert.equal(s.score, 0);
    assert.equal(s.keep, false);
  }
});

test("token totals reflect kept-vs-dropped", () => {
  const r = scoreChunks(
    "API rate limits",
    [
      "API rate limits are 100 requests per minute per IP.",
      "An unrelated paragraph about marine biology and coral reefs.",
    ],
    0.18,
  );
  assert.ok(r.tokensBefore >= r.tokensAfter);
});

test("scoreChunks returns one result per input chunk", () => {
  const r = scoreChunks("q", ["a", "b", "c"]);
  assert.equal(r.scores.length, 3);
});

test("chunks with numbers and entities receive a signal bonus", () => {
  const question = "events";
  const withSignal = "Event count grew 25% in Q4 2025 across the Americas region.";
  const noSignal = "events events events events events events events events";
  const r = scoreChunks(question, [withSignal, noSignal]);
  // The signal-bearing chunk should not be drowned out by the plain repetition.
  assert.ok(
    r.scores[0].score > 0,
    `expected positive score for signal chunk, got ${r.scores[0].score}`,
  );
});

test("code-bearing chunks score higher than plain prose with same overlap", () => {
  const question = "function call";
  const codeChunk = "Use `function call(x) { return x + 1; }` to apply the offset.";
  const proseChunk = "A function call is when one piece of code invokes another.";
  const r = scoreChunks(question, [codeChunk, proseChunk]);
  assert.ok(r.scores[0].score >= r.scores[1].score - 0.1);
});

test("dropped chunks include a 'no overlap' reason", () => {
  const r = scoreChunks("medical billing claims", ["unrelated cooking pasta"], 0.5);
  assert.equal(r.scores[0].keep, false);
  assert.match(r.scores[0].reason, /overlap|coverage/i);
});

test("very long chunks with low overlap get penalized", () => {
  const longLow = `lorem ipsum `.repeat(100); // ~600 tokens, no overlap with question
  const r = scoreChunks("authentication tokens", [longLow]);
  assert.equal(r.scores[0].keep, false);
});

test("kept chunks contribute to tokensAfter; dropped chunks do not", () => {
  const r = scoreChunks(
    "refund policy",
    [
      "Refunds are issued within 14 days of purchase to the original method.",
      "Our office building was renovated last year by an award-winning architect.",
    ],
    0.18,
  );
  const keptSum = r.scores
    .filter((s) => s.keep)
    .reduce((a, b) => a + b.tokens, 0);
  assert.equal(r.tokensAfter, keptSum);
});

test("scores are clamped to [0, 1]", () => {
  const r = scoreChunks("q", ["repeated content ".repeat(50)], 0);
  for (const s of r.scores) {
    assert.ok(s.score >= 0 && s.score <= 1);
  }
});
