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

test("parseCompressionJson handles whitespace-padded fenced JSON", () => {
  const out = parseCompressionJson(
    '\n\n   ```json\n{"compressed":"clean","notes":["a"]}\n```   \n\n',
  );
  assert.equal(out.compressed, "clean");
  assert.deepEqual(out.notes, ["a"]);
});

test("parseCompressionJson preserves multi-line compressed strings", () => {
  const out = parseCompressionJson(
    '{"compressed":"line1\\nline2","notes":["multi"]}',
  );
  assert.equal(out.compressed, "line1\nline2");
});

test("parseCompressionJson keeps a long notes array as-is", () => {
  const notes = ["a", "b", "c", "d", "e", "f"];
  const out = parseCompressionJson(
    JSON.stringify({ compressed: "x", notes }),
  );
  assert.deepEqual(out.notes, notes);
});

test("COMPRESSION_SYSTEM_PROMPT mentions the preserve constraints", () => {
  // These are the load-bearing rules — if they get edited out, prompts
  // will start losing entities/code on the AI path.
  assert.match(COMPRESSION_SYSTEM_PROMPT, /entities/i);
  assert.match(COMPRESSION_SYSTEM_PROMPT, /numeric|number/i);
  assert.match(COMPRESSION_SYSTEM_PROMPT, /code/i);
});
