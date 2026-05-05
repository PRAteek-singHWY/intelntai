"use client";

import { useState } from "react";
import type { Segment } from "@/lib/compress";

type Props = {
  segments: Segment[];
  showRemoved?: boolean;
};

const CATEGORY_BADGE: Record<string, { label: string; cls: string }> = {
  verbose: { label: "Verbose", cls: "chip" },
  filler: { label: "Filler", cls: "chip-light" },
  politeness: { label: "Politeness", cls: "chip-light" },
  meta: { label: "Meta", cls: "chip-mid" },
  duplicate: { label: "Duplicate", cls: "chip" },
  whitespace: { label: "Whitespace", cls: "chip" },
};

export default function TokenVisualizer({ segments, showRemoved = true }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  if (segments.length === 0) {
    return (
      <div className="text-muted text-sm italic px-4 py-8 text-center">
        Run compression to see the token-level diff.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="font-mono text-[13px] leading-[1.85] whitespace-pre-wrap break-words">
        {segments.map((seg, i) => {
          if (seg.kind === "kept") {
            return (
              <span key={i} className="token-kept">
                {seg.text}
              </span>
            );
          }
          if (seg.kind === "removed") {
            if (!showRemoved) return null;
            return (
              <span
                key={i}
                className="token-removed relative"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {seg.text}
                {hover === i && (
                  <Tooltip
                    reason={seg.reason}
                    badge={seg.category && CATEGORY_BADGE[seg.category]}
                    kind="removed"
                  />
                )}
              </span>
            );
          }
          // rewritten
          return (
            <span
              key={i}
              className="token-rewritten relative"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {seg.replacement || ""}
              {hover === i && (
                <Tooltip
                  reason={seg.reason}
                  original={seg.text}
                  badge={seg.category && CATEGORY_BADGE[seg.category]}
                  kind="rewritten"
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Tooltip({
  reason,
  original,
  badge,
  kind,
}: {
  reason?: string;
  original?: string;
  badge?: { label: string; cls: string };
  kind: "removed" | "rewritten";
}) {
  return (
    <span
      className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full z-30 pointer-events-none"
      style={{ minWidth: 220 }}
    >
      <span className="block card-2 px-3 py-2 text-xs text-foreground shadow-2xl border border-border-strong">
        <span className="flex items-center gap-2 mb-1">
          {badge && <span className={badge.cls}>{badge.label}</span>}
          <span className="text-muted-2 uppercase tracking-[0.15em] text-[10px]">
            {kind === "removed" ? "removed" : "rewritten"}
          </span>
        </span>
        <span className="block text-foreground/90">{reason}</span>
        {original && (
          <span className="block mt-1 text-muted">
            from: <span className="line-through">{original.trim()}</span>
          </span>
        )}
      </span>
    </span>
  );
}
