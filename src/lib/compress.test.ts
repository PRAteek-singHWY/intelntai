// Regression fixtures for the rule-based compression engine.
// Run with:  pnpm test
//
// Uses Node's built-in test runner + experimental TS stripping (Node 22.6+).
// No external test runner needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { compressRuleBased } from "./compress.ts";

const cases: { name: string; input: string; expectShorter: boolean; mustContain?: string[]; mustNotContain?: string[] }[] = [
  {
    name: "drops politeness preamble",
    input: "Could you please kindly summarize this for me, thanks in advance!",
    expectShorter: true,
    mustNotContain: ["please", "kindly", "thanks in advance"],
    mustContain: ["summarize"],
  },
  {
    name: "compresses verbose phrases",
    input: "In order to complete the task, due to the fact that we are short on time, please respond in a clear and concise manner.",
    expectShorter: true,
    mustContain: ["to", "because", "be concise"],
    mustNotContain: ["in order to", "due to the fact that", "respond in a clear and concise manner"],
  },
  {
    name: "strips meta filler",
    input: "Please note that it is important to note that the deadline is Friday.",
    expectShorter: true,
    mustNotContain: ["please note that", "it is important to note that"],
    mustContain: ["deadline is Friday"],
  },
  {
    name: "preserves named entities and numbers",
    input: "Please summarize the issue. Make sure to extract order #A-12947 and date 2026-04-12.",
    expectShorter: true,
    mustContain: ["#A-12947", "2026-04-12"],
  },
  {
    name: "removes filler intensifiers",
    input: "This is really very quite literally essentially the best approach.",
    expectShorter: true,
    mustNotContain: ["really", "very", "quite", "literally", "essentially"],
    mustContain: ["best approach"],
  },
  {
    name: "noop on already-tight prompt",
    input: "Summarize the user's issue in 2 sentences.",
    expectShorter: false,
  },
];

for (const tc of cases) {
  test(tc.name, () => {
    const result = compressRuleBased(tc.input);
    if (tc.expectShorter) {
      assert.ok(
        result.compressed.length < result.original.length,
        `expected compression. original=${result.original.length} compressed=${result.compressed.length}`,
      );
    } else {
      assert.equal(result.compressed.trim(), result.original.trim());
    }
    for (const needle of tc.mustContain ?? []) {
      assert.ok(
        result.compressed.includes(needle),
        `compressed output missing required string "${needle}". Got: ${result.compressed}`,
      );
    }
    for (const needle of tc.mustNotContain ?? []) {
      assert.ok(
        !result.compressed.toLowerCase().includes(needle.toLowerCase()),
        `compressed output should not contain "${needle}". Got: ${result.compressed}`,
      );
    }
  });
}

test("stats reflect categories", () => {
  const r = compressRuleBased("Please kindly help. In order to win, make sure to try.");
  assert.ok(r.stats.removedCount + r.stats.rewrittenCount > 0);
  assert.ok(r.stats.byCategory.politeness >= 1);
});
