import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPRESSION_SYSTEM_PROMPT, parseCompressionJson } from "./prompts.ts";

test("COMPRESSION_SYSTEM_PROMPT pins the JSON contract", () => {
  // The UI parses the AI response as JSON — if this prompt drifts away from
  // requesting strict JSON the route handler will start failing in prod.
  assert.match(COMPRESSION_SYSTEM_PROMPT, /strict JSON/i);
  assert.match(COMPRESSION_SYSTEM_PROMPT, /No markdown fences/);
});

test("parseCompressionJson parses a clean JSON response", () => {
  const out = parseCompressionJson('{"compressed":"hi","notes":["short"]}');
  assert.equal(out.compressed, "hi");
  assert.deepEqual(out.notes, ["short"]);
});

test("parseCompressionJson strips ```json fences", () => {
  const out = parseCompressionJson(
    '```json\n{"compressed":"x","notes":[]}\n```',
  );
  assert.equal(out.compressed, "x");
  assert.deepEqual(out.notes, []);
});

test("parseCompressionJson strips bare ``` fences", () => {
  const out = parseCompressionJson('```\n{"compressed":"y","notes":[]}\n```');
  assert.equal(out.compressed, "y");
});

test("parseCompressionJson falls back to raw text on invalid JSON", () => {
  const out = parseCompressionJson("not json at all");
  assert.equal(out.compressed, "not json at all");
  assert.deepEqual(out.notes, []);
});

test("parseCompressionJson tolerates missing notes field", () => {
  const out = parseCompressionJson('{"compressed":"only"}');
  assert.equal(out.compressed, "only");
  assert.deepEqual(out.notes, []);
});

test("parseCompressionJson tolerates non-array notes field", () => {
  const out = parseCompressionJson('{"compressed":"a","notes":"oops"}');
  assert.deepEqual(out.notes, []);
});
