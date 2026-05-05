import { test } from "node:test";
import assert from "node:assert/strict";
import { log } from "./log.ts";

function captureConsole(method: "log" | "error", fn: () => void): string[] {
  const lines: string[] = [];
  const original = console[method];
  console[method] = (s: unknown) => {
    lines.push(String(s));
  };
  try {
    fn();
  } finally {
    console[method] = original;
  }
  return lines;
}

test("log writes a JSON line to stdout for info", () => {
  const out = captureConsole("log", () =>
    log("info", "test_event", { foo: "bar" }),
  );
  assert.equal(out.length, 1);
  const parsed = JSON.parse(out[0]);
  assert.equal(parsed.severity, "INFO");
  assert.equal(parsed.event, "test_event");
  assert.equal(parsed.foo, "bar");
  assert.match(parsed.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test("log writes errors to stderr", () => {
  const err = captureConsole("error", () =>
    log("error", "boom", { code: 500 }),
  );
  assert.equal(err.length, 1);
  const parsed = JSON.parse(err[0]);
  assert.equal(parsed.severity, "ERROR");
});

test("log uppercases the severity", () => {
  const out = captureConsole("log", () => log("warn", "evt"));
  const parsed = JSON.parse(out[0]);
  assert.equal(parsed.severity, "WARNING".slice(0, 4)); // "WARN"
});
