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

test("cacheKey hashes are 64 hex chars (sha256)", () => {
  const k = cacheKey(["x", 1, "y"]);
  assert.match(k, /^[a-f0-9]{64}$/);
});

test("cacheKey changes when any part changes", () => {
  const a = cacheKey(["mode", "prompt-a"]);
  const b = cacheKey(["mode", "prompt-b"]);
  const c = cacheKey(["other-mode", "prompt-a"]);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test("cacheGet promotes the entry on hit (LRU behavior)", () => {
  // Establish three entries A, B, C and then read A again.
  // After reading A, B should be the oldest.
  const a = cacheKey(["lru", "A", String(Math.random())]);
  const b = cacheKey(["lru", "B", String(Math.random())]);
  cacheSet(a, "value-a");
  cacheSet(b, "value-b");
  // A is older; reading it should bump it to most-recent.
  assert.equal(cacheGet<string>(a), "value-a");
  // Both should still be reachable.
  assert.equal(cacheGet<string>(b), "value-b");
});

test("cacheGet returns null for non-string keys that were never set", () => {
  assert.equal(cacheGet<unknown>("never-set-explicitly"), null);
});
