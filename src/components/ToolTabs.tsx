"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Filter, Activity, Trophy } from "lucide-react";
import Compressor from "./Compressor";
import ContextPruner from "./ContextPruner";
import InfluenceMap from "./InfluenceMap";
import ModelArena from "./ModelArena";

const TABS = [
  {
    id: "compress",
    label: "Compressor",
    desc: "strip waste from prompts",
    icon: Wand2,
  },
  {
    id: "prune",
    label: "Context Pruner",
    desc: "drop RAG noise",
    icon: Filter,
  },
  {
    id: "influence",
    label: "Influence Map",
    desc: "see what moves the model",
    icon: Activity,
  },
  {
    id: "arena",
    label: "Model Arena",
    desc: "find your sweet spot",
    icon: Trophy,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ToolTabs() {
  const [active, setActive] = useState<TabId>("compress");

  return (
    <section id="tools" className="max-w-7xl mx-auto px-6 pt-10">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="chip-light mb-3">the full optimization stack</div>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight max-w-3xl">
          Four tools.{" "}
          <span className="bg-gradient-to-r from-neon to-mid bg-clip-text text-transparent">
            One bill to cut.
          </span>
        </h2>
        <p className="mt-3 text-muted max-w-2xl">
          Compression, context pruning, influence attribution, and model
          selection — every part of the prompt pipeline that bleeds tokens, in
          one place.
        </p>
      </div>

      <div
        role="tablist"
        className="card p-1.5 grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-8"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={`relative px-4 py-3 rounded-lg text-left transition-all ${
                isActive
                  ? "bg-surface-3 text-foreground"
                  : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute inset-0 rounded-lg border border-neon/40 shadow-[0_0_0_1px_var(--neon),0_8px_24px_-12px_rgba(180,252,74,0.4)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <div className="relative flex items-center gap-2">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-neon" : "text-muted-2"
                  }`}
                />
                <span className="text-sm font-medium">{t.label}</span>
              </div>
              <div className="relative text-[11px] text-muted-2 mt-1">
                {t.desc}
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {active === "compress" && <Compressor />}
          {active === "prune" && <ContextPruner />}
          {active === "influence" && <InfluenceMap />}
          {active === "arena" && <ModelArena />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
