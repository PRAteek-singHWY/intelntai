"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Filter, ChevronDown, ChevronUp, Check, X, Slash } from "lucide-react";
import { scoreChunks, type PruneResult } from "@/lib/relevance";
import { MODELS, formatUSD, inputCost } from "@/lib/pricing";
import NumberCounter from "./NumberCounter";

const SAMPLE_QUESTION = "What is the refund policy for unused subscription credits?";

const SAMPLE_CHUNKS = [
  `Customers may request a full refund within 14 days of purchase if they have not used any subscription credits. Unused credits are eligible for refund on a pro-rated basis after the 14-day window.`,
  `Our company was founded in 2018 by a team of ex-Stripe and Google engineers. We're headquartered in San Francisco with offices in Bangalore and Berlin. Our mission is to make billing infrastructure invisible.`,
  `Marketing newsletter signups grew 12% in Q4 2025. The blog team published 47 posts and the SEO traffic increased to 1.2M monthly visitors. Brand awareness in the developer ecosystem is strong.`,
  `Refund processing typically takes 5-7 business days through your original payment method. For prepaid annual plans, partial refunds are issued for the unused portion of credits.`,
  `Our enterprise tier customers receive 24/7 priority support with dedicated Slack channels and a named technical account manager. Mid-market customers get email-only support during business hours.`,
  `If a subscription includes credits that have not been consumed, eligibility for refund is determined by the time elapsed since the most recent renewal — credits older than 90 days are considered expired.`,
];

export default function ContextPruner() {
  const [question, setQuestion] = useState(SAMPLE_QUESTION);
  const [chunksText, setChunksText] = useState(SAMPLE_CHUNKS.join("\n\n"));
  const [threshold, setThreshold] = useState(0.18);

  const chunks = useMemo(
    () =>
      chunksText
        .split(/\n\s*\n+/)
        .map((c) => c.trim())
        .filter(Boolean),
    [chunksText],
  );

  const result: PruneResult = useMemo(
    () => scoreChunks(question, chunks, threshold),
    [question, chunks, threshold],
  );

  const sonnet = MODELS.find((m) => m.id === "claude-sonnet-4-6")!;
  const dollarSavedAtScale =
    (inputCost(result.tokensBefore, sonnet) - inputCost(result.tokensAfter, sonnet)) *
    1_000_000;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="chip">RAG context pruner</div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">
            Decide what's signal. Drop the rest.
          </h3>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Score each retrieved chunk against the user's question. Keep the
            ones that move the answer; cut the noise. Adjust the threshold to
            see where waste vs accuracy trades off.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="card lg:col-span-3 p-5">
          <label
            htmlFor="pruner-question"
            className="block text-xs uppercase tracking-[0.18em] text-muted mb-2"
          >
            user question
          </label>
          <input
            id="pruner-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon focus-visible:ring-2 focus-visible:ring-neon"
          />

          <label
            htmlFor="pruner-chunks"
            className="block text-xs uppercase tracking-[0.18em] text-muted mt-5 mb-2"
          >
            retrieved chunks · separate with blank line
          </label>
          <textarea
            id="pruner-chunks"
            value={chunksText}
            onChange={(e) => setChunksText(e.target.value)}
            className="w-full min-h-[260px] bg-surface-2 border border-border rounded-lg p-3 text-sm font-mono text-foreground placeholder:text-muted-2 focus:outline-none focus:border-neon focus-visible:ring-2 focus-visible:ring-neon resize-y"
          />
        </div>

        <div className="card lg:col-span-2 p-5 space-y-5">
          <div>
            <label
              htmlFor="pruner-threshold"
              className="block text-xs uppercase tracking-[0.18em] text-muted mb-3"
            >
              relevance threshold
            </label>
            <input
              id="pruner-threshold"
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={threshold}
              aria-valuemin={0}
              aria-valuemax={0.5}
              aria-valuenow={threshold}
              aria-valuetext={`${threshold.toFixed(2)} (${threshold < 0.15 ? "aggressive" : threshold > 0.35 ? "conservative" : "balanced"})`}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-[--neon] focus-visible:ring-2 focus-visible:ring-neon rounded"
              style={{ accentColor: "var(--neon)" }}
            />
            <div className="flex justify-between text-xs text-muted-2 mt-1">
              <span>aggressive</span>
              <span className="text-neon tabular">{threshold.toFixed(2)}</span>
              <span>conservative</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="kept" value={result.keptCount} accent />
            <Stat label="dropped" value={result.droppedCount} />
            <Stat
              label="tokens saved"
              value={result.tokensBefore - result.tokensAfter}
              accent
            />
            <Stat
              label="@ 1M calls"
              value={dollarSavedAtScale}
              fmt={(v) => formatUSD(v)}
            />
          </div>

          <div className="card-2 p-3 text-xs text-muted leading-relaxed">
            <strong className="text-foreground">How:</strong> question terms are
            stemmed and matched against each chunk; coverage + TF + entity
            bonuses produce a 0–1 score. Long chunks with low overlap get
            penalized. Swap-in real embeddings without changing the UI.
          </div>
        </div>
      </div>

      {/* ranked chunks */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-neon" aria-hidden="true" />
          <h4 className="font-semibold">Ranked chunks</h4>
        </div>

        <div className="space-y-2">
          {result.scores
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((c) => (
              <ChunkRow key={c.index} c={c} />
            ))}
        </div>
      </div>
    </div>
  );
}

function ChunkRow({
  c,
}: {
  c: ReturnType<typeof scoreChunks>["scores"][number];
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(c.score * 100);
  const panelId = `chunk-panel-${c.index}`;
  return (
    <div
      className={`card-2 transition-colors ${
        c.keep ? "border-neon/40" : "opacity-70"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${c.keep ? "Kept" : "Dropped"} chunk, ${pct}% relevance — ${open ? "collapse" : "expand"} details`}
        className="w-full flex items-center gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neon rounded-lg"
      >
        <div
          className="w-8 h-8 rounded-full grid place-items-center shrink-0"
          aria-hidden="true"
        >
          {c.keep ? (
            <Check className="w-4 h-4 text-neon" />
          ) : (
            <X className="w-4 h-4 text-muted-2" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs uppercase tracking-[0.16em] ${
                c.keep ? "text-neon" : "text-muted-2"
              }`}
            >
              {c.keep ? "keep" : "drop"}
            </span>
            <span className="text-xs text-muted-2">·</span>
            <span className="text-xs text-muted tabular">{c.tokens} tokens</span>
            <span className="text-xs text-muted-2">·</span>
            <span className="text-xs text-muted tabular">{c.overlap} term hits</span>
          </div>
          <div className="text-sm text-foreground/90 truncate">{c.text}</div>
        </div>

        <div className="w-32 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className={`h-full ${
                  c.keep
                    ? "bg-gradient-to-r from-mid to-neon"
                    : "bg-muted-2"
                }`}
              />
            </div>
            <span
              className={`text-xs tabular w-10 text-right ${
                c.keep ? "text-neon" : "text-muted-2"
              }`}
            >
              {pct}%
            </span>
          </div>
        </div>

        {open ? (
          <ChevronUp className="w-4 h-4 text-muted ml-2" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted ml-2" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div id={panelId} className="px-4 pb-4 pt-0 text-sm text-muted">
          <div className="card-2 p-3 mb-2 text-foreground/90 whitespace-pre-wrap">
            {c.text}
          </div>
          <div className="flex items-start gap-2">
            <Slash className="w-3 h-3 mt-1 text-muted-2 shrink-0" aria-hidden="true" />
            <span>{c.reason}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  fmt,
  accent,
}: {
  label: string;
  value: number;
  fmt?: (v: number) => string;
  accent?: boolean;
}) {
  const f = fmt ?? ((v: number) => Math.round(v).toLocaleString());
  return (
    <div className="card-2 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular ${
          accent ? "text-neon" : "text-foreground"
        }`}
      >
        <NumberCounter value={value} format={f} />
      </div>
    </div>
  );
}
