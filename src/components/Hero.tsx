"use client";

import { motion } from "framer-motion";
import { ArrowDown, Zap, DollarSign, Eye } from "lucide-react";
import NumberCounter from "./NumberCounter";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative mesh-bg mesh-bg-animated overflow-hidden border-b border-border"
    >
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="chip mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-neon pulse-neon" />
          Built for PromptWars × Google × Scaler
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-5xl md:text-7xl font-semibold tracking-tight max-w-4xl glow-text"
        >
          Make every token{" "}
          <span className="bg-gradient-to-r from-neon via-light to-mid bg-clip-text text-transparent">
            count.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-lg md:text-xl text-muted max-w-2xl leading-relaxed"
        >
          Up to <span className="text-light font-medium">40% of tokens</span> in
          production prompts add no semantic value. Tokenly compresses your
          prompts, visualizes the waste, and shows live cost across every major
          LLM — so you stop paying for tokens that don't move the model.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 flex flex-wrap gap-3 justify-center"
        >
          <a
            href="#compressor"
            className="btn-primary inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon"
          >
            Try the live compressor
            <ArrowDown className="w-4 h-4" aria-hidden="true" />
          </a>
          <a
            href="#how"
            className="btn-ghost inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon"
          >
            See how it works
          </a>
        </motion.div>

        {/* stat strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl"
        >
          <StatCard
            icon={<Zap className="w-4 h-4" />}
            label="Avg tokens cut"
            value={42}
            suffix="%"
          />
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Saved per 1M calls"
            value={3120}
            prefix="$"
          />
          <StatCard
            icon={<Eye className="w-4 h-4" />}
            label="Categories detected"
            value={6}
          />
        </motion.div>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  prefix,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const fmt = (v: number) =>
    `${prefix ?? ""}${Math.round(v).toLocaleString()}${suffix ?? ""}`;
  return (
    <div className="card p-5 text-left">
      <div className="flex items-center gap-2 text-muted text-xs uppercase tracking-[0.18em]">
        <span className="text-neon" aria-hidden="true">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-4xl font-semibold text-foreground">
        <NumberCounter value={value} format={fmt} />
      </div>
    </div>
  );
}
