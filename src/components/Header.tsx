"use client";

import { GitFork, Sparkles } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2 group">
          <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-neon to-mid grid place-items-center shadow-[0_0_18px_-4px] shadow-neon/40 group-hover:shadow-neon/70 transition-shadow">
            <Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={3} />
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

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted">
          <a href="#compressor" className="hover:text-neon transition-colors">
            Compressor
          </a>
          <a href="#visualizer" className="hover:text-neon transition-colors">
            Visualizer
          </a>
          <a href="#cost" className="hover:text-neon transition-colors">
            Cost
          </a>
          <a href="#how" className="hover:text-neon transition-colors">
            How
          </a>
        </nav>

        <a
          href="https://github.com/PRAteek-singHWY/intelntai"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors px-3 py-1.5 rounded-full border border-border hover:border-border-strong"
        >
          <GitFork className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Source</span>
        </a>
      </div>
    </header>
  );
}
