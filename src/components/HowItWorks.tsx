"use client";

import { motion } from "framer-motion";
import {
  Wand2,
  Filter,
  Activity,
  Trophy,
  ArrowRight,
  Layers,
  ShieldCheck,
  Coins,
} from "lucide-react";

const STAGES = [
  {
    icon: Wand2,
    title: "Compress",
    body: "26 deterministic rules + Claude-driven deep rewrite. Verbose phrasing collapsed, fillers cut, duplicates merged. Semantic intent preserved.",
  },
  {
    icon: Filter,
    title: "Prune",
    body: "Each retrieved chunk scored against the user's intent. Noise dropped before it ever reaches the model. Pluggable into any RAG pipeline.",
  },
  {
    icon: Activity,
    title: "Attribute",
    body: "Heatmap each token by estimated influence. See exactly which words move the model and which are dead weight burning your budget.",
  },
  {
    icon: Trophy,
    title: "Arbitrage",
    body: "Same prompt, every model, real pricing. Sweet-spot selector optimizes value per call against your budget and the prompt's complexity.",
  },
];

const PILLARS = [
  {
    icon: Layers,
    title: "One stack, not seven tools",
    body: "Compression, pruning, attribution, and arbitrage in one product. No tool-stitching, no auth maze.",
  },
  {
    icon: ShieldCheck,
    title: "Semantic-safe by default",
    body: "Rules-based engine never touches code blocks, named entities, numbers, or constraints. Cuts only the bloat.",
  },
  {
    icon: Coins,
    title: "Real money, real fast",
    body: "Live cost projections across nine major models. See your savings at 1, 1k, 1M calls before you ship the change.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <div className="chip mx-auto">how it works</div>
        <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight max-w-3xl mx-auto">
          A four-stage pipeline that{" "}
          <span className="bg-gradient-to-r from-neon to-mid bg-clip-text text-transparent">
            squeezes every prompt
          </span>{" "}
          before it bills you.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              viewport={{ once: true, margin: "-80px" }}
              className="card p-5 relative"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg grid place-items-center bg-neon-soft border border-neon/25">
                  <Icon className="w-4 h-4 text-neon" aria-hidden="true" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-2">
                  stage {i + 1}
                </span>
              </div>
              <h3 className="font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm text-muted mt-2 leading-relaxed">
                {s.body}
              </p>
              {i < STAGES.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-5 h-5 text-neon hidden md:block"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="card p-6">
              <Icon className="w-5 h-5 text-neon mb-3" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">{p.title}</h3>
              <p className="text-sm text-muted mt-1 leading-relaxed">
                {p.body}
              </p>
            </div>
          );
        })}
      </div>

      {/* Pitch closing */}
      <div className="mt-16 card p-8 md:p-12 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 100% at 100% 50%, rgba(180,252,74,0.10), transparent 70%)",
          }}
        />
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="chip-mid mb-3">the pitch</div>
            <h2 className="text-2xl md:text-4xl font-semibold tracking-tight">
              Anthropic alone bills $15 per million input tokens.
            </h2>
            <p className="text-muted mt-3 leading-relaxed">
              When 40% of those tokens are filler and duplicates, every team
              running production LLMs is leaving five-to-six figures on the
              table per year. Tokenly closes the gap in a single drop-in
              compression layer.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Quote num="40%" label="avg waste in production prompts" />
            <Quote num="$3.1k" label="saved per 1M calls (Sonnet)" accent />
            <Quote num="9" label="models compared in real time" />
            <Quote num="0ms" label="rules-engine latency overhead" accent />
          </div>
        </div>
      </div>
    </section>
  );
}

function Quote({
  num,
  label,
  accent,
}: {
  num: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="card-2 p-4">
      <div
        className={`text-3xl font-semibold tabular ${
          accent ? "text-neon" : "text-foreground"
        }`}
      >
        {num}
      </div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}
