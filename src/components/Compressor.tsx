"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Cpu,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  TrendingDown,
  AlertCircle,
  Globe,
} from "lucide-react";

import type { CompressResult } from "@/lib/compress";
import { countTokens } from "@/lib/tokenizer";
import { MODELS, formatUSD, inputCost } from "@/lib/pricing";

import TokenVisualizer from "./TokenVisualizer";
import CostComparison from "./CostComparison";
import NumberCounter from "./NumberCounter";

const EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: "Customer support",
    prompt: `I would like you to please act as a customer support assistant. Please be aware that you should respond in a clear and concise manner. It is important to note that you must always be polite. Make sure to address the customer by their name. I want you to also kindly summarize their issue at the end. Please ensure that you are very helpful. Could you please provide a step-by-step solution? Please note that thank you in advance for your help.`,
  },
  {
    label: "RAG system prompt",
    prompt: `You are an AI assistant. I would like you to answer the user's question based on the context provided below. Please note that you should only use information from the context. It is important to note that if the context does not contain the answer, you should say so. In order to be helpful, please provide citations. Make sure to be very concise. Please ensure that your response is accurate. Due to the fact that hallucinations are bad, please verify each and every claim. Thank you in advance for your help.

Context:
{context}

Question: {question}`,
  },
  {
    label: "Code reviewer",
    prompt: `I would really like you to please review the following code. It is important to note that you should look for bugs. Make sure to also check for security issues. Please be aware that performance matters too. I want you to be very thorough. Could you please provide specific line numbers? Kindly explain each and every issue clearly. Make sure that you are constructive in your feedback. Thank you in advance for your help.

Code:
{code}`,
  },
  {
    label: "Bloated agent",
    prompt: `I want you to act as an autonomous agent. I would like you to please plan tasks step by step. It is important to note that at this point in time you should not make assumptions. Please ensure that you verify each step. Due to the fact that errors compound, please be very careful. Make sure to also handle edge cases. I'd like you to literally think about every possible failure mode. Could you please basically reason through the problem first? Kindly note that the answer must be correct. Please note that the answer must also be concise. As a matter of fact, you should always cite your sources. Thank you in advance.`,
  },
];

type Mode = "rules" | "ai" | "gemini" | "both" | "all";

type ApiResponse = {
  rules: CompressResult;
  ai?: { compressed: string; notes: string[] } | null;
  gemini?: { compressed: string; notes: string[] } | null;
  aiError?: string;
  geminiError?: string;
};

export default function Compressor() {
  const [input, setInput] = useState<string>(EXAMPLES[0].prompt);
  const [mode, setMode] = useState<Mode>("rules");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const liveTokens = useMemo(() => countTokens(input), [input]);

  const run = useCallback(async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: input, mode }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ApiResponse;
      setResult(json);
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [input, mode, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  return (
    <section
      id="compressor"
      className="relative max-w-7xl mx-auto px-6 py-20"
    >
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="chip">live demo</div>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            The compressor
          </h2>
          <p className="mt-2 text-muted max-w-xl">
            Paste a prompt. We'll strip the waste, show you exactly what was cut
            and why, and project the savings across every major LLM.
          </p>
        </div>
        <div className="text-sm text-muted-2">
          <kbd className="px-1.5 py-0.5 rounded border border-border text-xs">⌘</kbd>
          <span className="mx-1">+</span>
          <kbd className="px-1.5 py-0.5 rounded border border-border text-xs">Enter</kbd>
          <span className="ml-2">to compress</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* INPUT */}
        <div className="card lg:col-span-3 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="chip-light">input</span>
              <span className="text-muted text-xs tabular">
                {liveTokens.toLocaleString()} tokens · {input.length} chars
              </span>
            </div>
            <button
              type="button"
              onClick={() => setInput("")}
              aria-label="Clear input prompt"
              className="text-xs text-muted hover:text-neon transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon rounded"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              clear
            </button>
          </div>

          <label htmlFor="compressor-input" className="sr-only">
            Prompt to compress
          </label>
          <textarea
            id="compressor-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a system prompt, RAG instruction template, or any prompt with bloat…"
            aria-label="Prompt to compress"
            className="flex-1 min-h-[280px] w-full bg-surface-2 border border-border rounded-lg p-4 text-sm font-mono text-foreground placeholder:text-muted-2 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon resize-y"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-2 mr-1">examples:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setInput(ex.prompt)}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-neon hover:bg-neon-soft transition-colors text-muted hover:text-neon"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTROLS */}
        <div className="card lg:col-span-2 p-5 flex flex-col gap-5">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted mb-3">
              compression mode
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ModeButton
                label="Rules"
                desc="instant"
                active={mode === "rules"}
                onClick={() => setMode("rules")}
                icon={<Wand2 className="w-3.5 h-3.5" aria-hidden="true" />}
              />
              <ModeButton
                label="Claude"
                desc="anthropic"
                active={mode === "ai"}
                onClick={() => setMode("ai")}
                icon={<Cpu className="w-3.5 h-3.5" aria-hidden="true" />}
              />
              <ModeButton
                label="Gemini"
                desc="vertex ai"
                active={mode === "gemini"}
                onClick={() => setMode("gemini")}
                icon={<Globe className="w-3.5 h-3.5" aria-hidden="true" />}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <ModeButton
                label="Both AIs"
                desc="claude + gemini"
                active={mode === "all"}
                onClick={() => setMode("all")}
                icon={<Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
              />
              <ModeButton
                label="Rules + Claude"
                desc="combo"
                active={mode === "both"}
                onClick={() => setMode("both")}
                icon={<Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
              />
            </div>
            <p className="text-xs text-muted-2 mt-3 leading-relaxed">
              {mode === "rules"
                ? "26 deterministic rules: verbose phrases, fillers, politeness, redundant meta-instructions, duplicates."
                : mode === "ai"
                ? "Claude Sonnet rewrites your prompt with semantic preservation. Slower, deeper cuts."
                : mode === "gemini"
                ? "Gemini 2.5 Flash via Vertex AI on Google Cloud — same task, different model perspective."
                : mode === "all"
                ? "Run Claude and Gemini side-by-side. Pick whichever cuts deeper without losing intent."
                : "Run rules + Claude — see the deterministic baseline alongside the AI-driven rewrite."}
            </p>
          </div>

          <button
            type="button"
            onClick={run}
            disabled={!input.trim() || loading}
            aria-busy={loading}
            aria-label={loading ? "Compressing prompt" : "Compress prompt"}
            className="btn-primary w-full inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Compressing…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Compress prompt
              </>
            )}
          </button>

          {error && (
            <div
              role="alert"
              className="text-sm text-danger flex items-start gap-2 p-3 rounded-lg border border-danger/30 bg-danger-soft"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Live cost preview */}
          <div className="card-2 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted mb-2">
              live input cost (per call)
            </div>
            <div className="space-y-1.5 text-sm">
              {MODELS.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <span className="text-muted">{m.label}</span>
                  <span className="text-foreground tabular">
                    {formatUSD(inputCost(liveTokens, m))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <div ref={resultsRef} className="mt-12">
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Results data={result} originalInput={input} mode={mode} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function ModeButton({
  label,
  desc,
  active,
  onClick,
  icon,
}: {
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Compression mode: ${label}`}
      className={`relative rounded-lg p-3 text-left border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-neon ${
        active
          ? "border-neon bg-neon-soft text-foreground shadow-[0_0_0_1px_var(--neon),0_8px_24px_-12px_rgba(180,252,74,0.4)]"
          : "border-border bg-surface-2 text-muted hover:border-border-strong hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <span className={active ? "text-neon" : ""}>{icon}</span>
        {label}
      </div>
      <div className="text-[10px] text-muted-2 uppercase tracking-[0.16em] mt-1">
        {desc}
      </div>
    </button>
  );
}

// ────────────────────────── results ──────────────────────────

function Results({
  data,
  originalInput,
  mode,
}: {
  data: ApiResponse;
  originalInput: string;
  mode: Mode;
}) {
  const tokensOriginal = countTokens(originalInput);
  const tokensRules = countTokens(data.rules.compressed);
  const tokensAI = data.ai ? countTokens(data.ai.compressed) : null;
  const tokensGemini = data.gemini ? countTokens(data.gemini.compressed) : null;

  type SrcLabel = "rules" | "ai" | "gemini";
  const candidates: { src: SrcLabel; tokens: number; text: string }[] = [
    { src: "rules", tokens: tokensRules, text: data.rules.compressed },
  ];
  if (tokensAI !== null && tokensAI > 0)
    candidates.push({ src: "ai", tokens: tokensAI, text: data.ai!.compressed });
  if (tokensGemini !== null && tokensGemini > 0)
    candidates.push({
      src: "gemini",
      tokens: tokensGemini,
      text: data.gemini!.compressed,
    });
  const winner = candidates.reduce((best, c) =>
    c.tokens > 0 && c.tokens < best.tokens ? c : best,
  );
  const bestTokens = winner.tokens;
  const bestText = winner.text;
  const bestSource = winner.src;

  const tokenSavings = tokensOriginal - bestTokens;
  const pctSaved =
    tokensOriginal > 0 ? (tokenSavings / tokensOriginal) * 100 : 0;

  return (
    <div className="space-y-6">
      <SavingsCard
        tokensOriginal={tokensOriginal}
        tokensCompressed={bestTokens}
        pctSaved={pctSaved}
        source={bestSource}
      />

      <div id="visualizer" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="chip">original · annotated</span>
              <span className="text-xs text-muted tabular">
                {tokensOriginal} tokens
              </span>
            </div>
            <span className="text-xs text-muted-2">hover any cut to see why</span>
          </div>
          <div className="card-2 p-4 max-h-[440px] overflow-y-auto">
            <TokenVisualizer segments={data.rules.segments} />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="chip-mid">compressed · clean</span>
              <span className="text-xs text-muted tabular">
                {bestTokens} tokens · {bestSource === "ai" ? "AI" : "Rules"}
              </span>
            </div>
            <CopyButton text={bestText} />
          </div>
          <div className="card-2 p-4 max-h-[440px] overflow-y-auto whitespace-pre-wrap font-mono text-[13px] leading-[1.85] text-foreground">
            {bestText || (
              <span className="text-muted italic">No content remained.</span>
            )}
          </div>
        </div>
      </div>

      <CutsBreakdown stats={data.rules.stats} />

      {/* Claude panel */}
      {(mode === "ai" || mode === "both" || mode === "all") && (
        <AIPanel
          provider="Claude"
          subtitle="claude-sonnet-4-6"
          ai={data.ai}
          aiError={data.aiError}
          tokens={tokensAI ?? 0}
        />
      )}

      {/* Gemini panel */}
      {(mode === "gemini" || mode === "all") && (
        <AIPanel
          provider="Gemini"
          subtitle="gemini-2.5-flash · Vertex AI"
          ai={data.gemini}
          aiError={data.geminiError}
          tokens={tokensGemini ?? 0}
        />
      )}

      <div id="cost">
        <CostComparison
          tokensBefore={tokensOriginal}
          tokensAfter={bestTokens}
        />
      </div>
    </div>
  );
}

function SavingsCard({
  tokensOriginal,
  tokensCompressed,
  pctSaved,
  source,
}: {
  tokensOriginal: number;
  tokensCompressed: number;
  pctSaved: number;
  source: "rules" | "ai" | "gemini";
}) {
  // Project savings against Sonnet 4.6 as the default illustrative model
  const sonnet = MODELS.find((m) => m.id === "claude-sonnet-4-6")!;
  const dollarPerCallSaved =
    inputCost(tokensOriginal, sonnet) - inputCost(tokensCompressed, sonnet);
  const dollarAtScale = dollarPerCallSaved * 1_000_000;

  return (
    <div className="relative card p-7 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(60% 80% at 80% 50%, rgba(180,252,74,0.18), transparent 70%), radial-gradient(40% 80% at 0% 100%, rgba(34,197,94,0.15), transparent 70%)",
        }}
      />
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat
          label="tokens saved"
          value={tokensOriginal - tokensCompressed}
          fmt={(v) => `${Math.round(v).toLocaleString()}`}
          accent
        />
        <Stat
          label="reduction"
          value={pctSaved}
          fmt={(v) => `${v.toFixed(1)}%`}
          accent
        />
        <Stat
          label="saved per 1M calls (Sonnet)"
          value={dollarAtScale}
          fmt={(v) => formatUSD(v)}
        />
        <Stat
          label="engine"
          value={0}
          fmt={() =>
            source === "ai" ? "Claude" : source === "gemini" ? "Gemini" : "Rules"
          }
        />
      </div>
      <div className="relative mt-6 flex items-center gap-2 text-sm text-muted">
        <TrendingDown className="w-4 h-4 text-neon" />
        <span>
          From <span className="text-foreground tabular">{tokensOriginal}</span>{" "}
          → <span className="text-neon tabular">{tokensCompressed}</span> tokens
          · semantic intent preserved.
        </span>
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
  fmt: (v: number) => string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
      </div>
      <div
        className={`mt-2 text-3xl md:text-4xl font-semibold tabular ${
          accent ? "text-neon glow-text" : "text-foreground"
        }`}
      >
        <NumberCounter value={value} format={fmt} />
      </div>
    </div>
  );
}

function CutsBreakdown({ stats }: { stats: CompressResult["stats"] }) {
  const cats: { key: keyof typeof stats.byCategory; label: string; color: string }[] = [
    { key: "verbose", label: "Verbose phrasing", color: "text-neon" },
    { key: "filler", label: "Filler words", color: "text-light" },
    { key: "politeness", label: "Politeness", color: "text-light" },
    { key: "meta", label: "Meta-instructions", color: "text-mid" },
    { key: "duplicate", label: "Duplicates", color: "text-neon" },
    { key: "whitespace", label: "Whitespace", color: "text-muted" },
  ];
  const total = stats.removedCount + stats.rewrittenCount;
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="chip-light">cuts breakdown</div>
          <h3 className="text-lg font-semibold mt-3">
            {total} edits applied · categorized
          </h3>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cats.map((c) => {
          const v = stats.byCategory[c.key] ?? 0;
          return (
            <div
              key={c.key}
              className="card-2 px-4 py-3 flex items-center justify-between"
            >
              <span className="text-sm text-muted">{c.label}</span>
              <span className={`text-xl font-semibold tabular ${c.color}`}>
                {v}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AIPanel({
  provider,
  subtitle,
  ai,
  aiError,
  tokens,
}: {
  provider: string;
  subtitle: string;
  ai: ApiResponse["ai"] | ApiResponse["gemini"];
  aiError?: string;
  tokens: number;
}) {
  if (aiError) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="chip">{provider}</span>
          <span className="text-xs text-muted-2">{subtitle}</span>
        </div>
        <div className="text-sm text-warn flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <div className="text-foreground">{provider} compression unavailable.</div>
            <div className="text-muted-2 text-xs mt-1">{aiError}</div>
          </div>
        </div>
      </div>
    );
  }
  if (!ai) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="chip">{provider} · notes</span>
          <span className="text-xs text-muted-2">{subtitle}</span>
          <span className="text-xs text-muted tabular">{tokens} tokens</span>
        </div>
        <CopyButton text={ai.compressed} />
      </div>
      {ai.notes.length > 0 ? (
        <ul className="space-y-1.5">
          {ai.notes.map((n, i) => (
            <li
              key={i}
              className="text-sm text-foreground flex items-start gap-2"
            >
              <span className="text-neon mt-1.5 w-1 h-1 rounded-full bg-neon shrink-0" />
              {n}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted italic">No notes returned.</p>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          /* noop */
        }
      }}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      aria-live="polite"
      className="text-xs text-muted hover:text-neon inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon rounded"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" aria-hidden="true" /> copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" aria-hidden="true" /> copy
        </>
      )}
    </button>
  );
}
