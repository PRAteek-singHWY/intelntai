import { test } from "node:test";
import assert from "node:assert/strict";
import { countTokens, approxTokens } from "./tokenizer.ts";

test("countTokens returns 0 for empty string", () => {
  assert.equal(countTokens(""), 0);
});

test("countTokens grows with input length", () => {
  const small = countTokens("hello world");
  const big = countTokens(
    "hello world ".repeat(50),
  );
  assert.ok(big > small);
});

test("approxTokens applies provider scalars", () => {
  const text = "Compress this prompt to fewer tokens please.";
  const base = countTokens(text);
  const anthropic = approxTokens(text, "Anthropic");
  const google = approxTokens(text, "Google");
  // Anthropic scalar is highest, plain is lowest.
  assert.ok(anthropic >= base);
  assert.ok(google >= base);
});

test("approxTokens with no provider equals countTokens", () => {
  const t = "the quick brown fox jumps over the lazy dog";
  assert.equal(approxTokens(t), countTokens(t));
});

test("approxTokens with DeepSeek scalar equals base count", () => {
  const t = "deepseek tokenizer is roughly equivalent in our model";
  assert.equal(approxTokens(t, "DeepSeek"), countTokens(t));
});

test("approxTokens with an unknown provider falls through to base", () => {
  const t = "an unknown provider should not crash the function";
  assert.equal(approxTokens(t, "Unknown" as never), countTokens(t));
});

test("countTokens is deterministic for the same input", () => {
  const t = "Compression preserves intent.";
  assert.equal(countTokens(t), countTokens(t));
});

test("countTokens handles unicode and emoji", () => {
  // gpt-tokenizer should not throw on non-ASCII content.
  const t = "Compress 日本語 prompts and emoji 🎯 too.";
  const n = countTokens(t);
  assert.ok(n > 0);
});
