import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, clientIp } from "./rate-limit.ts";

test("clientIp prefers x-forwarded-for first hop", () => {
  const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
  assert.equal(clientIp(h), "203.0.113.5");
});

test("clientIp falls back to x-real-ip", () => {
  const h = new Headers({ "x-real-ip": "198.51.100.7" });
  assert.equal(clientIp(h), "198.51.100.7");
});

test("clientIp returns 'unknown' when nothing is set", () => {
  assert.equal(clientIp(new Headers()), "unknown");
});

test("rateLimit allows requests under the cap", () => {
  const ip = `test-ok-${Math.random()}`;
  const r = rateLimit(ip);
  assert.equal(r.ok, true);
  assert.ok(r.remaining >= 0);
});

test("rateLimit blocks after the burst is exhausted", () => {
  const ip = `test-burst-${Math.random()}`;
  // 20 burst tokens — drain them all.
  for (let i = 0; i < 20; i += 1) rateLimit(ip);
  const r = rateLimit(ip);
  assert.equal(r.ok, false);
  assert.equal(r.remaining, 0);
  assert.ok(r.retryAfterSec >= 0);
});

test("rateLimit returns independent buckets per IP", () => {
  const a = `iso-a-${Math.random()}`;
  const b = `iso-b-${Math.random()}`;
  for (let i = 0; i < 20; i += 1) rateLimit(a);
  const blocked = rateLimit(a);
  const fresh = rateLimit(b);
  assert.equal(blocked.ok, false);
  assert.equal(fresh.ok, true);
});
