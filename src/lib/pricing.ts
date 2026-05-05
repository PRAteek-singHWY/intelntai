// Per-million-token pricing (USD). Approximate public list rates as of early 2026.
// Used for cost-savings demos — not billing-grade.

export type Model = {
  id: string;
  provider: "OpenAI" | "Anthropic" | "Google" | "DeepSeek" | "Meta";
  label: string;
  inputPerM: number;
  outputPerM: number;
  tier: "frontier" | "balanced" | "fast";
};

export const MODELS: Model[] = [
  { id: "gpt-4o", provider: "OpenAI", label: "GPT-4o", inputPerM: 2.5, outputPerM: 10, tier: "frontier" },
  { id: "gpt-4o-mini", provider: "OpenAI", label: "GPT-4o mini", inputPerM: 0.15, outputPerM: 0.6, tier: "fast" },
  { id: "o1", provider: "OpenAI", label: "o1", inputPerM: 15, outputPerM: 60, tier: "frontier" },
  { id: "claude-opus-4-7", provider: "Anthropic", label: "Claude Opus 4.7", inputPerM: 15, outputPerM: 75, tier: "frontier" },
  { id: "claude-sonnet-4-6", provider: "Anthropic", label: "Claude Sonnet 4.6", inputPerM: 3, outputPerM: 15, tier: "balanced" },
  { id: "claude-haiku-4-5", provider: "Anthropic", label: "Claude Haiku 4.5", inputPerM: 1, outputPerM: 5, tier: "fast" },
  { id: "gemini-2-pro", provider: "Google", label: "Gemini 2 Pro", inputPerM: 1.25, outputPerM: 5, tier: "balanced" },
  { id: "gemini-2-flash", provider: "Google", label: "Gemini 2 Flash", inputPerM: 0.1, outputPerM: 0.4, tier: "fast" },
  { id: "deepseek-v3", provider: "DeepSeek", label: "DeepSeek V3", inputPerM: 0.27, outputPerM: 1.1, tier: "balanced" },
];

export function inputCost(tokens: number, model: Model): number {
  return (tokens / 1_000_000) * model.inputPerM;
}

export function outputCost(tokens: number, model: Model): number {
  return (tokens / 1_000_000) * model.outputPerM;
}

export function totalCost(
  inputTokens: number,
  outputTokens: number,
  model: Model,
): number {
  return inputCost(inputTokens, model) + outputCost(outputTokens, model);
}

export function findModel(id: string): Model | undefined {
  return MODELS.find((m) => m.id === id);
}

export function formatUSD(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  if (value === 0) return "$0";
  if (value < 0.0001) return `$${value.toExponential(2)}`;
  if (value < 0.01) return `$${value.toFixed(5)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${Math.round(value).toLocaleString()}`;
}
