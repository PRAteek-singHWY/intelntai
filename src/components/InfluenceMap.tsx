"use client";

import { useMemo, useState } from "react";
import { Activity, Eye, EyeOff } from "lucide-react";
import { scoreInfluence, type WordScore } from "@/lib/influence";
import NumberCounter from "./NumberCounter";

const SAMPLE = `You are a customer support agent. Please always be polite and helpful. I would really like you to summarize the user's issue in 2 sentences. Make sure to extract any order numbers like #A-12947 and dates such as 2026-04-12. Never make up information. If you don't know, ask a clarifying question. Refund eligibility is 14 days from purchase.`;

export default function InfluenceMap() {
  const [text, setText] = useState(SAMPLE);
  const [hideLow, setHideLow] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const result = useMemo(() => scoreInfluence(text), [text]);

  // total token weight (proxy for "useful tokens")
  const usefulTokens = result.words.reduce(
    (s, w) => s + (w.word ? w.score : 0),
    0,
  );
  const totalWords = result.words.filter((w) => w.word).length;
  const wastePct =
    totalWords > 0 ? (result.lowCount / totalWords) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="chip-light">influence map</div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">
            Which tokens actually move the model?
          </h3>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Heatmap by estimated influence. Bright = high signal (instructions,
            entities, numbers). Dim = low signal (politeness, fillers,
            stopwords). If half your prompt is dim, you're paying for noise.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHideLow((v) => !v)}
          aria-pressed={hideLow}
          className="btn-ghost inline-flex items-center gap-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-neon"
        >
          {hideLow ? (
            <>
              <Eye className="w-4 h-4" aria-hidden="true" />
              show low-signal
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4" aria-hidden="true" />
              hide low-signal
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="card lg:col-span-3 p-5">
          <label
            htmlFor="influence-prompt"
            className="block text-xs uppercase tracking-[0.18em] text-muted mb-2"
          >
            prompt
          </label>
          <textarea
            id="influence-prompt"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[200px] bg-surface-2 border border-border rounded-lg p-3 text-sm font-mono text-foreground focus:outline-none focus:border-neon focus-visible:ring-2 focus-visible:ring-neon resize-y"
          />

          <div
            id="heatmap-label"
            className="mt-5 text-xs uppercase tracking-[0.18em] text-muted mb-3"
          >
            heatmap
          </div>
          <div
            className="card-2 p-4 leading-[2] font-mono text-[14px]"
            role="figure"
            aria-labelledby="heatmap-label"
          >
            {result.words.map((w, i) => (
              <Token
                key={i}
                w={w}
                hidden={hideLow && w.bucket === "low"}
                onHover={() => setHover(i)}
                onLeave={() => setHover(null)}
                isHovered={hover === i}
              />
            ))}
          </div>
        </div>

        <div className="card lg:col-span-2 p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="avg influence"
              value={result.averageScore * 100}
              fmt={(v) => `${v.toFixed(0)}%`}
              accent
            />
            <Stat label="high-signal words" value={result.highCount} accent />
            <Stat label="low-signal words" value={result.lowCount} />
            <Stat
              label="estimated waste"
              value={wastePct}
              fmt={(v) => `${v.toFixed(0)}%`}
            />
          </div>

          <Legend />

          <div className="card-2 p-3 text-xs text-muted leading-relaxed">
            <strong className="text-foreground">How it works:</strong> a
            heuristic blends part-of-speech approximation with entity/number
            detection and an instruction-verb dictionary. The score is a 0–1
            estimate of each word's pull on the model. Pluggable for
            attention-rollout / logprob-based attribution when those are
            available.
          </div>

          <div className="card-2 p-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted mb-2">
              top high-signal words
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.words
                .filter((w) => w.bucket === "high")
                .slice(0, 12)
                .map((w, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-md bg-neon-soft text-neon border border-neon/25 tabular"
                  >
                    {w.word}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Token({
  w,
  hidden,
  onHover,
  onLeave,
  isHovered,
}: {
  w: WordScore;
  hidden: boolean;
  onHover: () => void;
  onLeave: () => void;
  isHovered: boolean;
}) {
  if (!w.word) return <span>{w.raw}</span>;
  if (hidden) {
    return (
      <span className="text-muted-2 opacity-30">
        {w.raw.replace(/./g, "·")}
      </span>
    );
  }

  // Map score to color + weight + underline thickness so the channel is not
  // color-only (a11y: colorblind users still get scale via weight + decoration).
  const intensity = Math.max(0.08, Math.min(1, w.score));
  const bgAlpha = intensity * 0.65;
  const isHigh = w.bucket === "high";
  const isLow = w.bucket === "low";
  const underlineThickness = isHigh ? Math.max(1, Math.round(intensity * 3)) : 0;

  return (
    <span
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      tabIndex={0}
      role="button"
      aria-label={`${w.word}: ${w.bucket} signal, ${(w.score * 100).toFixed(0)} percent. ${w.reason}`}
      title={`${w.bucket} · ${(w.score * 100).toFixed(0)}% — ${w.reason}`}
      className="relative cursor-help rounded-[3px] px-[3px] py-[1px] mx-[0.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon"
      style={{
        background: isHigh
          ? `rgba(180, 252, 74, ${bgAlpha})`
          : isLow
          ? "rgba(125, 125, 125, 0.08)"
          : `rgba(217, 249, 157, ${bgAlpha * 0.55})`,
        color: isHigh ? "#04080a" : isLow ? "var(--muted-2)" : "var(--foreground)",
        fontWeight: isHigh ? 700 : isLow ? 300 : 500,
        fontStyle: isLow ? "italic" : "normal",
        textDecoration: isHigh
          ? "underline"
          : isLow
          ? "line-through"
          : "none",
        textDecorationThickness: isHigh ? `${underlineThickness}px` : isLow ? "1px" : undefined,
        textDecorationColor: isHigh ? "rgba(4,8,10,0.55)" : isLow ? "rgba(125,125,125,0.4)" : undefined,
        textUnderlineOffset: isHigh ? "3px" : undefined,
        boxShadow: isHigh
          ? `0 0 ${Math.round(intensity * 14)}px rgba(180,252,74,${intensity * 0.35})`
          : "none",
      }}
    >
      {w.raw}
      {isHovered && (
        <span
          className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full z-30 pointer-events-none"
          style={{ minWidth: 200 }}
        >
          <span className="block card-2 px-3 py-2 text-xs shadow-2xl border border-border-strong">
            <span className="text-foreground font-medium">{w.word}</span>
            <span className="block text-muted-2 text-[10px] uppercase tracking-[0.14em] mt-0.5">
              {w.bucket} · {(w.score * 100).toFixed(0)}%
            </span>
            <span className="block text-muted mt-1">{w.reason}</span>
          </span>
        </span>
      )}
    </span>
  );
}

function Legend() {
  return (
    <div className="card-2 p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-muted mb-3">
        legend
      </div>
      <div className="flex items-center gap-2">
        <div
          className="flex-1 h-3 rounded-full"
          style={{
            background:
              "linear-gradient(to right, rgba(125,125,125,0.18), rgba(217,249,157,0.5), rgba(180,252,74,0.95))",
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-2 mt-1.5 uppercase tracking-[0.16em]">
        <span><span className="line-through italic">noise</span></span>
        <span><span className="underline font-bold">signal</span></span>
      </div>
      <div className="text-[10px] text-muted-2 mt-2 leading-relaxed">
        Color, weight & underline all encode score so the heatmap stays readable
        without relying on hue.
      </div>
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
