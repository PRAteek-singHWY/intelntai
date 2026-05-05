import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleCompress,
  type AiResult,
  type CompressDeps,
} from "./compress-handler.ts";

// Silence the structured logger writes so test output stays readable.
function silenceConsole<T>(fn: () => Promise<T>): Promise<T> {
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  return fn().finally(() => {
    console.log = origLog;
    console.error = origErr;
  });
}

function makeDeps(overrides: Partial<CompressDeps> = {}): CompressDeps {
  return {
    claudeCompress: async (p) => ({
      compressed: `[claude]${p.slice(0, 8)}`,
      notes: ["claude-note"],
    }),
    geminiCompress: async (p) => ({
      compressed: `[gemini]${p.slice(0, 8)}`,
      notes: ["gemini-note"],
    }),
    geminiAvailable: () => true,
    logCompression: async () => {},
    ...overrides,
  };
}

test("rules mode runs the deterministic engine and skips both AIs", async () => {
  let claudeCalls = 0;
  let geminiCalls = 0;
  const deps = makeDeps({
    claudeCompress: async () => {
      claudeCalls += 1;
      return { compressed: "x", notes: [] };
    },
    geminiCompress: async () => {
      geminiCalls += 1;
      return { compressed: "x", notes: [] };
    },
  });
  const out = await silenceConsole(() =>
    handleCompress(
      { prompt: "Please kindly summarize this for me", mode: "rules", ip: "1" },
      deps,
    ),
  );
  assert.equal(claudeCalls, 0);
  assert.equal(geminiCalls, 0);
  assert.equal(out.response.ai, undefined);
  assert.equal(out.response.gemini, undefined);
  assert.ok(out.response.rules.compressed.length > 0);
});

test("ai mode invokes Claude and surfaces its result", async () => {
  const deps = makeDeps();
  const out = await silenceConsole(() =>
    handleCompress(
      { prompt: "please be concise", mode: "ai", ip: "ai-ok" },
      deps,
    ),
  );
  assert.ok(out.response.ai);
  assert.match(out.response.ai!.compressed, /^\[claude\]/);
  assert.equal(out.response.aiError, undefined);
  assert.equal(out.response.gemini, undefined);
});

test("ai mode surfaces a Claude failure as aiError without throwing", async () => {
  const deps = makeDeps({
    claudeCompress: async () => {
      throw new Error("claude exploded");
    },
  });
  const out = await silenceConsole(() =>
    handleCompress(
      { prompt: "anything", mode: "ai", ip: "ai-fail" },
      deps,
    ),
  );
  assert.equal(out.response.ai, null);
  assert.match(out.response.aiError ?? "", /claude exploded/);
});

test("gemini mode reports unavailability cleanly", async () => {
  const deps = makeDeps({ geminiAvailable: () => false });
  const out = await silenceConsole(() =>
    handleCompress(
      { prompt: "x", mode: "gemini", ip: "no-gem" },
      deps,
    ),
  );
  assert.equal(out.response.gemini, null);
  assert.match(out.response.geminiError ?? "", /Gemini not configured/i);
});

test("'all' mode runs both Claude and Gemini and returns both", async () => {
  const deps = makeDeps();
  const out = await silenceConsole(() =>
    handleCompress(
      { prompt: "do the thing please", mode: "all", ip: "all-ok" },
      deps,
    ),
  );
  assert.ok(out.response.ai);
  assert.ok(out.response.gemini);
  assert.match(out.response.ai!.compressed, /^\[claude\]/);
  assert.match(out.response.gemini!.compressed, /^\[gemini\]/);
});

test("'both' mode runs Claude only (rules + Claude combo)", async () => {
  let claudeCalls = 0;
  let geminiCalls = 0;
  const deps = makeDeps({
    claudeCompress: async () => {
      claudeCalls += 1;
      return { compressed: "c", notes: [] };
    },
    geminiCompress: async () => {
      geminiCalls += 1;
      return { compressed: "g", notes: [] };
    },
  });
  await silenceConsole(() =>
    handleCompress(
      { prompt: "do thing", mode: "both", ip: "both-ok" },
      deps,
    ),
  );
  assert.equal(claudeCalls, 1);
  assert.equal(geminiCalls, 0);
});

test("identical prompts return X-Cache HIT on the second AI call", async () => {
  const prompt = `cache-test-${Math.random()}`; // unique to dodge prior runs
  let calls = 0;
  const deps = makeDeps({
    claudeCompress: async (p): Promise<AiResult> => {
      calls += 1;
      return { compressed: p.toUpperCase(), notes: [] };
    },
  });
  const first = await silenceConsole(() =>
    handleCompress({ prompt, mode: "ai", ip: "cache-1" }, deps),
  );
  const second = await silenceConsole(() =>
    handleCompress({ prompt, mode: "ai", ip: "cache-2" }, deps),
  );
  assert.equal(calls, 1, "Claude should run once; second call hits cache");
  assert.equal(first.headers["X-Cache"], "MISS");
  assert.equal(second.headers["X-Cache"], "HIT");
  assert.equal(second.response.cache, "hit");
});

test("logCompression is invoked once per request with the right shape", async () => {
  const calls: Parameters<CompressDeps["logCompression"]>[0][] = [];
  const deps = makeDeps({
    logCompression: async (rec) => {
      calls.push(rec);
    },
  });
  await silenceConsole(() =>
    handleCompress(
      { prompt: "hello world", mode: "rules", ip: "log-1" },
      deps,
    ),
  );
  assert.equal(calls.length, 1);
  const r = calls[0];
  assert.equal(r.ip, "log-1");
  assert.equal(r.mode, "rules");
  assert.equal(r.cache, "n/a");
  assert.equal(typeof r.tokensBefore, "number");
  assert.equal(typeof r.tokensAfter, "number");
  assert.equal(typeof r.pctSaved, "number");
  assert.ok(r.promptPreview.length <= 200);
});

test("very long prompts get truncated for the Firestore preview", async () => {
  let recorded = "";
  const deps = makeDeps({
    logCompression: async (rec) => {
      recorded = rec.promptPreview;
    },
  });
  const big = "x ".repeat(2000);
  await silenceConsole(() =>
    handleCompress({ prompt: big, mode: "rules", ip: "trim" }, deps),
  );
  assert.equal(recorded.length, 200);
});

test("Gemini failure surfaces as geminiError without affecting Claude", async () => {
  const deps = makeDeps({
    geminiCompress: async () => {
      throw new Error("vertex 503");
    },
  });
  const out = await silenceConsole(() =>
    handleCompress(
      { prompt: "x prompt", mode: "all", ip: "mix" },
      deps,
    ),
  );
  assert.ok(out.response.ai);
  assert.equal(out.response.gemini, null);
  assert.match(out.response.geminiError ?? "", /vertex 503/);
});

test("non-Error throwables from Claude still produce a string aiError", async () => {
  const deps = makeDeps({
    claudeCompress: async () => {
      throw "plain string error"; // eslint-disable-line @typescript-eslint/only-throw-error
    },
  });
  const out = await silenceConsole(() =>
    handleCompress(
      { prompt: "anything", mode: "ai", ip: "weird" },
      deps,
    ),
  );
  assert.equal(out.response.ai, null);
  assert.equal(typeof out.response.aiError, "string");
});
