import { Sparkles, GitFork } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-12 mesh-bg">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-neon to-mid grid place-items-center">
            <Sparkles className="w-3 h-3 text-deep" strokeWidth={3} />
          </div>
          <span className="text-foreground font-medium">Tokenly</span>
          <span>· Make every token count.</span>
        </div>
        <div className="text-xs text-muted-2 flex items-center gap-4">
          <span>Built solo for PromptWars × Google × Scaler · 2026</span>
          <a
            href="https://github.com/PRAteek-singHWY/intelntai"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neon transition-colors inline-flex items-center gap-1.5"
          >
            <GitFork className="w-3 h-3" />
            source
          </a>
        </div>
      </div>
    </footer>
  );
}
