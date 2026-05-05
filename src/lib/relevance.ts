// Heuristic RAG relevance scorer — no external embeddings required.
// Combines token overlap (Jaccard-like), TF weighting, and signal bonuses
// (numbers, capitalized entities, code) to produce a 0..1 relevance score
// for each candidate chunk against a question.

import { countTokens } from "./tokenizer";

const STOPWORDS = new Set([
  "a","an","the","of","to","in","on","at","for","with","by","from","is","are","was","were","be","been","being",
  "and","or","but","if","then","else","so","as","than","that","this","these","those","it","its","into","about",
  "i","you","we","they","he","she","them","us","me","him","her","my","your","our","their","his","hers",
  "do","does","did","done","have","has","had","not","no","yes","can","could","would","should","will","may","might",
  "what","which","who","whom","when","where","why","how",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (t.length < 2) continue;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

function signalBonus(text: string): number {
  let bonus = 0;
  if (/\d/.test(text)) bonus += 0.04;
  if (/[A-Z][a-z]+\s[A-Z][a-z]+/.test(text)) bonus += 0.04; // proper nouns
  if (/[`]{1,3}|\bfunction\b|\bclass\b|\breturn\b|=>/.test(text)) bonus += 0.04; // code
  if (/\$\d|\d%/.test(text)) bonus += 0.03;
  return Math.min(bonus, 0.15);
}

export type ChunkScore = {
  index: number;
  text: string;
  score: number; // 0..1
  tokens: number;
  overlap: number;
  reason: string;
  keep: boolean;
};

export type PruneResult = {
  threshold: number;
  scores: ChunkScore[];
  tokensBefore: number;
  tokensAfter: number;
  keptCount: number;
  droppedCount: number;
};

export function scoreChunks(
  question: string,
  chunks: string[],
  threshold = 0.18,
): PruneResult {
  const qTokens = tokenize(question);
  const qSet = new Set(qTokens.filter((t) => !STOPWORDS.has(t) && t.length > 1));
  const qTotal = qSet.size || 1;

  const scores: ChunkScore[] = chunks.map((chunkRaw, index) => {
    const text = chunkRaw.trim();
    if (!text) {
      return {
        index,
        text,
        score: 0,
        tokens: 0,
        overlap: 0,
        reason: "empty",
        keep: false,
      };
    }
    const tokens = countTokens(text);
    const cTokens = tokenize(text);
    const cFreq = termFreq(cTokens);

    let overlap = 0;
    let weighted = 0;
    for (const term of qSet) {
      const f = cFreq.get(term) ?? 0;
      if (f > 0) {
        overlap += 1;
        weighted += Math.log(1 + f);
      }
    }

    // base: jaccard-ish coverage of question terms
    const coverage = overlap / qTotal;
    // tf weighting (capped) gives long-form chunks a small boost when relevant
    const tfBoost = Math.min(weighted / Math.max(qTotal, 1), 0.4);
    // length penalty: very long chunks with little overlap get punished
    const lenPenalty =
      tokens > 200 && coverage < 0.3 ? -0.08 * Math.log10(tokens / 200) : 0;

    const sig = signalBonus(text);
    const raw = coverage * 0.7 + tfBoost * 0.5 + sig + lenPenalty;
    const score = Math.max(0, Math.min(1, raw));

    let reason: string;
    if (overlap === 0) reason = "no question-term overlap — likely noise";
    else if (coverage > 0.6) reason = "high coverage of question terms";
    else if (coverage > 0.3) reason = "partial coverage";
    else reason = "low coverage";
    if (sig > 0) reason += " · contains entities/numbers";
    if (lenPenalty < 0) reason += " · long & off-topic (penalized)";

    return {
      index,
      text,
      score,
      tokens,
      overlap,
      reason,
      keep: score >= threshold,
    };
  });

  const tokensBefore = scores.reduce((s, c) => s + c.tokens, 0);
  const tokensAfter = scores.filter((c) => c.keep).reduce((s, c) => s + c.tokens, 0);

  return {
    threshold,
    scores,
    tokensBefore,
    tokensAfter,
    keptCount: scores.filter((c) => c.keep).length,
    droppedCount: scores.filter((c) => !c.keep).length,
  };
}
