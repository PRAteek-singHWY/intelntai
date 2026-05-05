"use client";

import { useMemo, useState } from "react";
import { Crosshair, Gauge, Trophy } from "lucide-react";
import { MODELS, formatUSD, inputCost } from "@/lib/pricing";
import { countTokens } from "@/lib/tokenizer";
import { scoreInfluence } from "@/lib/influence";

const QUALITY_TIER: Record<string, number> = {
  frontier: 0.95,
  balanced: 0.78,
  fast: 0.62,
};

const SPEED_TIER: Record<string, number> = {
  frontier: 0.45,
  balanced: 0.75,
  fast: 0.95,
};

const SAMPLE = `You are a code reviewer. Analyze the diff for security bugs, performance regressions, and unidiomatic patterns. Cite specific line numbers. Output JSON with fields: severity, line, issue, fix.`;

export default function ModelArena() {
  const [prompt, setPrompt] = useState(SAMPLE);
  const [outputTokens, setOutputTokens] = useState(400);
  const [callsPerMonth, setCallsPerMonth] = useState(1_000_000);
  const [budget, setBudget] = useState(0.005);

  const inputTokens = useMemo(() => countTokens(prompt), [prompt]);
  // a tiny "task complexity" hint from the prompt — high-signal density
  // implies harder task, which should bias toward higher-quality models
  const taskComplexity = useMemo(() => {
    const inf = scoreInfluence(prompt);
    return Math.min(1, inf.averageScore + inf.highCount / 60);
  }, [prompt]);

  const rows = useMemo(() => {
    return MODELS.map((m) => {
      const costPerCall =
        inputCost(inputTokens, m) +
        (outputTokens / 1_000_000) * m.outputPerM;
      const monthly = costPerCall * callsPerMonth;
      const quality = QUALITY_TIER[m.tier];
      const speed = SPEED_TIER[m.tier];
      const value = (quality * 0.6 + speed * 0.4) / Math.max(costPerCall, 1e-6);
      // suitability — given the prompt's apparent complexity
      const suitability =
        m.tier === "fast" && taskComplexity > 0.55
          ? 0.6
          : m.tier === "frontier" && taskComplexity < 0.4
          ? 0.7
          : 1.0;
      return {
        ...m,
        costPerCall,
        monthly,
        quality,
        speed,
        value: value * suitability,
        underBudget: costPerCall <= budget,
        suitability,
      };
    });
  }, [inputTokens, outputTokens, callsPerMonth, budget, taskComplexity]);

  const sweetSpot = useMemo(() => {
    const eligible = rows.filter((r) => r.underBudget);
    if (eligible.length === 0) return rows[0]; // anyway-pick
    return eligible.reduce((best, r) => (r.value > best.value ? r : best));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <div className="chip-mid">model arena · sweet-spot finder</div>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">
          Cost vs speed vs quality. Pick the right model for the job.
        </h3>
        <p className="text-muted text-sm mt-1 max-w-2xl">
          The same prompt run against every major model. Set your per-call
          budget and we'll pick the highest-value model that stays inside it,
          weighted by the prompt's apparent complexity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="card lg:col-span-3 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted mb-2">
            prompt
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full min-h-[140px] bg-surface-2 border border-border rounded-lg p-3 text-sm font-mono text-foreground focus:outline-none focus:border-neon resize-y"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <NumberInput
              label="output tokens / call"
              value={outputTokens}
              onChange={setOutputTokens}
              min={50}
              max={8000}
              step={50}
            />
            <NumberInput
              label="calls / month"
              value={callsPerMonth}
              onChange={setCallsPerMonth}
              min={1000}
              max={50_000_000}
              step={10_000}
            />
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                budget / call
              </div>
              <input
                type="range"
                min={0.0001}
                max={0.05}
                step={0.0001}
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: "var(--neon)" }}
              />
              <div className="text-xs text-neon tabular mt-1">
                {formatUSD(budget)}
              </div>
            </div>
          </div>
        </div>

        <div className="card lg:col-span-2 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-neon" />
            <div className="chip">recommended</div>
          </div>
          <div className="text-2xl font-semibold">{sweetSpot.label}</div>
          <div className="text-sm text-muted mt-1">
            {sweetSpot.provider} · {sweetSpot.tier}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Mini label="cost / call" value={formatUSD(sweetSpot.costPerCall)} />
            <Mini label="monthly" value={formatUSD(sweetSpot.monthly)} accent />
            <Mini
              label="quality"
              value={`${Math.round(sweetSpot.quality * 100)}%`}
            />
            <Mini
              label="speed"
              value={`${Math.round(sweetSpot.speed * 100)}%`}
            />
          </div>

          <div className="card-2 p-3 mt-4 text-xs text-muted leading-relaxed">
            <Crosshair className="w-3 h-3 inline-block text-neon mr-1" />
            Sweet spot ranks models by{" "}
            <span className="text-foreground">
              (quality × 0.6 + speed × 0.4) ÷ cost
            </span>
            , filtered by your per-call budget, biased by prompt complexity.
          </div>
        </div>
      </div>

      {/* arena table */}
      <div className="card p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-4 h-4 text-neon" />
          <h4 className="font-semibold">All models · ranked by value</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-[0.14em]">
                <th className="text-left px-3 py-2 font-normal">Model</th>
                <th className="text-right px-3 py-2 font-normal">$/call</th>
                <th className="text-right px-3 py-2 font-normal">$/mo</th>
                <th className="text-left px-3 py-2 font-normal">Quality</th>
                <th className="text-left px-3 py-2 font-normal">Speed</th>
                <th className="text-right px-3 py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t border-border ${
                      r.id === sweetSpot.id ? "bg-neon-soft/40" : ""
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{r.label}</span>
                        <span className="text-[10px] text-muted-2 uppercase tracking-[0.14em]">
                          {r.provider}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular">
                      {formatUSD(r.costPerCall)}
                    </td>
                    <td className="px-3 py-3 text-right tabular text-foreground">
                      {formatUSD(r.monthly)}
                    </td>
                    <td className="px-3 py-3">
                      <Bar value={r.quality} color="neon" />
                    </td>
                    <td className="px-3 py-3">
                      <Bar value={r.speed} color="light" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.id === sweetSpot.id ? (
                        <span className="chip">sweet spot</span>
                      ) : r.underBudget ? (
                        <span className="chip-mid">in-budget</span>
                      ) : (
                        <span className="text-xs text-muted-2">over-budget</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: "neon" | "light" }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full ${
            color === "neon"
              ? "bg-gradient-to-r from-mid to-neon"
              : "bg-gradient-to-r from-mid/40 to-light"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular text-muted w-9 text-right">{pct}%</span>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
        {label}
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-neon tabular"
      />
    </div>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="card-2 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-semibold tabular ${
          accent ? "text-neon" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
