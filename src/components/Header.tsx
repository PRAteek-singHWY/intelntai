"use client";

import { Sparkles } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <a
          href="#top"
          aria-label="Tokenly home"
          className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-neon rounded"
        >
          <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-neon to-mid grid place-items-center shadow-[0_0_18px_-4px] shadow-neon/40 group-hover:shadow-neon/70 transition-shadow">
            <Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={3} aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-foreground tracking-tight text-base">
              Tokenly
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-2">
              v0.1
            </span>
          </div>
        </a>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm text-muted"
        >
          <a
            href="#compressor"
            className="hover:text-neon transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon rounded"
          >
            Compressor
          </a>
          <a
            href="#visualizer"
            className="hover:text-neon transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon rounded"
          >
            Visualizer
          </a>
          <a
            href="#cost"
            className="hover:text-neon transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon rounded"
          >
            Cost
          </a>
          <a
            href="#how"
            className="hover:text-neon transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon rounded"
          >
            How
          </a>
        </nav>

        <span
          className="inline-flex items-center gap-2 text-sm text-muted px-3 py-1.5 rounded-full border border-border"
          role="status"
          aria-label="Live demo running"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_8px] shadow-neon"
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Live demo</span>
        </span>
      </div>
    </header>
  );
}
