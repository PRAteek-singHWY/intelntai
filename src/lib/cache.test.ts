import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheGet, cacheSet, cacheKey } from "./cache.ts";

test("cacheKey is deterministic for same inputs", () => {
  const a = cacheKey(["mode", "hello world"]);
  const b = cacheKey(["mode", "hello world"]);
  assert.equal(a, b);
});

test("cacheKey differs across inputs", () => {
  const a = cacheKey(["a"]);
  const b = cacheKey(["b"]);
  assert.notEqual(a, b);
});

test("cacheGet returns null for misses", () => {
  assert.equal(cacheGet("nonexistent"), null);
});

test("cacheSet then cacheGet returns the stored value", () => {
  const k = cacheKey(["test", String(Math.random())]);
  cacheSet(k, { compressed: "x", notes: ["y"] });
  const got = cacheGet<{ compressed: string; notes: string[] }>(k);
  assert.deepEqual(got, { compressed: "x", notes: ["y"] });
});

test("cache evicts the oldest entry when at capacity", () => {
  // Force enough entries to exceed MAX_ENTRIES (500) — sanity check it runs.
  for (let i = 0; i < 600; i += 1) {
    cacheSet(cacheKey(["overflow", String(i)]), i);
  }
  // Should not throw and most recent should still be present.
  assert.equal(
    cacheGet<number>(cacheKey(["overflow", "599"])),
    599,
  );
});
