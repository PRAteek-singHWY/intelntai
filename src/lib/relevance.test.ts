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
