import { encode } from "gpt-tokenizer";

// gpt-tokenizer uses cl100k by default — close enough for cross-model
// approximation. For Anthropic/Google we apply a small per-provider scalar
// since their BPE vocabs differ slightly in practice.
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

export function approxTokens(text: string, provider?: string): number {
  const base = countTokens(text);
  switch (provider) {
    case "Anthropic":
      return Math.round(base * 1.05);
    case "Google":
      return Math.round(base * 1.02);
    case "DeepSeek":
      return Math.round(base * 1.0);
    default:
      return base;
  }
}
