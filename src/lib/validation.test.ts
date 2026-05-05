import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBody } from "./validation.ts";

test("validateBody rejects null/undefined payloads", () => {
  for (const raw of [null, undefined, 42, "string", true]) {
    const r = validateBody(raw);
    assert.equal("error" in r, true);
    if ("error" in r) assert.equal(r.status, 400);
  }
});

test("validateBody rejects an empty / whitespace-only prompt", () => {
  for (const prompt of ["", "   ", "\n\t"]) {
    const r = validateBody({ prompt });
    assert.equal("error" in r, true);
    if ("error" in r) {
      assert.equal(r.status, 400);
      assert.match(r.error, /empty/i);
    }
  }
});

test("validateBody rejects a missing prompt field", () => {
  const r = validateBody({});
  assert.equal("error" in r, true);
  if ("error" in r) assert.equal(r.status, 400);
});

test("validateBody rejects prompts over 50k chars with HTTP 413", () => {
  const big = "a".repeat(50_001);
  const r = validateBody({ prompt: big });
  assert.equal("error" in r, true);
  if ("error" in r) {
    assert.equal(r.status, 413);
    assert.match(r.error, /too large/i);
  }
});

test("validateBody defaults mode to 'rules' when not provided", () => {
  const r = validateBody({ prompt: "hello world" });
  assert.equal("error" in r, false);
  if (!("error" in r)) {
    assert.equal(r.prompt, "hello world");
    assert.equal(r.mode, "rules");
  }
});

test("validateBody preserves an explicit mode", () => {
  for (const mode of ["rules", "ai", "gemini", "both", "all"] as const) {
    const r = validateBody({ prompt: "hi", mode });
    assert.equal("error" in r, false);
    if (!("error" in r)) assert.equal(r.mode, mode);
  }
});

test("validateBody coerces non-string prompt fields via toString", () => {
  const r = validateBody({ prompt: 12345 });
  assert.equal("error" in r, false);
  if (!("error" in r)) assert.equal(r.prompt, "12345");
});

test("validateBody accepts a prompt at exactly the 50k boundary", () => {
  const exact = "x".repeat(50_000);
  const r = validateBody({ prompt: exact });
  assert.equal("error" in r, false);
});

test("validateBody rejects unknown mode strings with 400", () => {
  const r = validateBody({ prompt: "hi", mode: "wat" });
  assert.equal("error" in r, true);
  if ("error" in r) {
    assert.equal(r.status, 400);
    assert.match(r.error, /Invalid mode/i);
  }
});

test("validateBody rejects non-string mode values", () => {
  for (const mode of [123, true, ["ai"], { mode: "ai" }]) {
    const r = validateBody({ prompt: "hi", mode });
    assert.equal("error" in r, true);
    if ("error" in r) assert.equal(r.status, 400);
  }
});
