"use client";

import { MODELS, formatUSD, inputCost } from "@/lib/pricing";
import { TrendingDown } from "lucide-react";

type Props = {
  tokensBefore: number;
  tokensAfter: number;
};

export default function CostComparison({ tokensBefore, tokensAfter }: Props) {
  const SCALE = 1_000_000;
  const totalSavings = MODELS.reduce((sum, m) => {
    const before = inputCost(tokensBefore, m) * SCALE;
    const after = inputCost(tokensAfter, m) * SCALE;
    return sum + (before - after);
  }, 0);

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="chip-mid">cost across models</div>
          <h3 className="text-lg font-semibold mt-3">
            Per-call cost · projected savings at{" "}
            <span className="text-neon">1M calls</span>
          </h3>
          <p className="text-muted text-sm mt-1">
            Real public list pricing. Input-token only — output is unaffected by
            compression.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">
            total saved across models
          </div>
          <div
            className="text-3xl font-semibold text-neon mt-1 tabular flex items-center gap-2 justify-end"
            aria-live="polite"
          >
            <TrendingDown className="w-5 h-5" aria-hidden="true" />
            {formatUSD(totalSavings)}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm" aria-label="Per-call cost and savings across LLM providers">
          <caption className="sr-only">
            Per-call input cost before and after compression for nine major
            LLMs, with projected savings at one million calls and percentage
            reduction.
          </caption>
          <thead>
            <tr className="bg-surface-2 text-muted text-xs uppercase tracking-[0.14em]">
              <th className="text-left px-4 py-3 font-normal">Model</th>
              <th className="text-right px-4 py-3 font-normal">Before / call</th>
              <th className="text-right px-4 py-3 font-normal">After / call</th>
              <th className="text-right px-4 py-3 font-normal">Saved @ 1M</th>
              <th className="text-right px-4 py-3 font-normal">Δ</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m) => {
              const before = inputCost(tokensBefore, m);
              const after = inputCost(tokensAfter, m);
              const savedScaled = (before - after) * SCALE;
              const pct = before > 0 ? ((before - after) / before) * 100 : 0;
              return (
                <tr
                  key={m.id}
                  className="border-t border-border hover:bg-surface-2/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{m.label}</span>
                      <span className="text-[10px] text-muted-2 uppercase tracking-[0.14em]">
                        {m.provider}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted tabular">
                    {formatUSD(before)}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground tabular">
                    {formatUSD(after)}
                  </td>
                  <td className="px-4 py-3 text-right text-neon tabular font-medium">
                    {formatUSD(savedScaled)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="chip-mid tabular">−{pct.toFixed(1)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
