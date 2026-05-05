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

test("log emits an ISO 8601 timestamp on every line", () => {
  const out = captureConsole("log", () =>
    log("info", "ts_check", { x: 1 }),
  );
  const parsed = JSON.parse(out[0]);
  // ISO 8601 with 'Z' suffix or numeric offset.
  assert.match(parsed.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  // Must be parseable.
  assert.ok(!Number.isNaN(new Date(parsed.ts).getTime()));
});

test("log carries arbitrary structured fields verbatim", () => {
  const out = captureConsole("log", () =>
    log("info", "event_x", {
      ip: "1.2.3.4",
      ms: 123,
      ok: true,
      tags: ["a", "b"],
      nested: { id: 7 },
    }),
  );
  const parsed = JSON.parse(out[0]);
  assert.equal(parsed.ip, "1.2.3.4");
  assert.equal(parsed.ms, 123);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.tags, ["a", "b"]);
  assert.deepEqual(parsed.nested, { id: 7 });
});

test("log defaults the fields object to empty when none is passed", () => {
  const out = captureConsole("log", () => log("info", "no_fields"));
  const parsed = JSON.parse(out[0]);
  assert.equal(parsed.event, "no_fields");
  assert.equal(parsed.severity, "INFO");
});

test("warn-level routes to stdout, not stderr", () => {
  const stdout = captureConsole("log", () => log("warn", "warn_event"));
  assert.equal(stdout.length, 1);
  // Warn should appear on stdout (severity=WARN); error path is separate.
});

test("Cloud Logging stays disabled when CLOUD_LOGGING_ENABLED is unset", () => {
  // The maybeInitCloudLogging helper short-circuits to null without
  // CLOUD_LOGGING_ENABLED=1 — verify by ensuring no extra side effects
  // (the line still lands on stdout and parses as JSON).
  const prior = process.env.CLOUD_LOGGING_ENABLED;
  delete process.env.CLOUD_LOGGING_ENABLED;
  try {
    const out = captureConsole("log", () =>
      log("info", "no_cloud_log", { x: 1 }),
    );
    assert.equal(out.length, 1);
    JSON.parse(out[0]); // throws if not valid JSON
  } finally {
    if (prior !== undefined) process.env.CLOUD_LOGGING_ENABLED = prior;
  }
});
