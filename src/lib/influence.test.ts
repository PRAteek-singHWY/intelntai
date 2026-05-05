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

test("code-like tokens score high", () => {
  const r = scoreInfluence("Call findUser() with id=42 to get the result.");
  const codey = r.words.find((w) => /findUser/.test(w.word));
  assert.ok(codey);
  assert.equal(codey!.bucket, "high");
});

test("inline code with $ and = is detected as code", () => {
  const r = scoreInfluence("Set $TOKEN=secret to authenticate.");
  const codey = r.words.find((w) => /TOKEN/.test(w.word));
  assert.ok(codey);
  assert.equal(codey!.bucket, "high");
});

test("stopwords are bucketed low even when capitalized at start", () => {
  const r = scoreInfluence("The cat sat on the mat.");
  const the = r.words.find((w) => w.word.toLowerCase() === "the");
  assert.ok(the);
  assert.equal(the!.bucket, "low");
});

test("proper-noun heuristic catches mid-sentence capitalized words", () => {
  const r = scoreInfluence("We work with Acme Corp on payroll.");
  const acme = r.words.find((w) => w.word === "Acme");
  assert.ok(acme);
  assert.equal(acme!.bucket, "high");
});

test("words at sentence start are not auto-flagged as proper nouns", () => {
  // "Always" follows a period — should be picked up as a high-signal verb,
  // not as a proper noun. Either way it should be bucket=high, but the
  // *reason* should not mislabel.
  const r = scoreInfluence("Yes. Always cite.");
  const always = r.words.find((w) => w.word.toLowerCase() === "always");
  assert.ok(always);
  assert.equal(always!.bucket, "high");
  assert.match(always!.reason, /instruction|content/i);
});

test("very short content words score in the medium bucket", () => {
  const r = scoreInfluence("Get key now.");
  const get = r.words.find((w) => w.word === "Get");
  // "Get" is mid-length, capitalized at sentence start (prev=null) so not proper.
  // It's also not in the high-signal verb dictionary; bucket should be 'med'.
  assert.ok(get);
  assert.equal(get!.bucket, "med");
});

test("score is always between 0 and 1", () => {
  const r = scoreInfluence(
    "Compress this prompt. Never hallucinate. Order #A-12 dated 2026-01-01 must be returned. Please be helpful.",
  );
  for (const w of r.words) {
    assert.ok(w.score >= 0 && w.score <= 1);
  }
});

test("whitespace tokens are emitted with zero score", () => {
  const r = scoreInfluence("hi world");
  const ws = r.words.find((w) => /^\s+$/.test(w.raw));
  assert.ok(ws);
  assert.equal(ws!.score, 0);
});
