// Heuristic prompt-influence scorer — answers "which tokens actually move
// the model vs which are dead weight?" without needing logprobs.
//
// Score per word is a weighted vote across signals:
//   - high: instructions (must/never/always), numbers, code, named entities,
//           technical nouns, proper nouns
//   - low : politeness, fillers, generic verbs, stopwords
// Output is 0..1 per word; the UI renders a green-intensity heatmap.

const HIGH_SIGNAL_VERBS = new Set([
  "must","never","always","require","return","output","format","include","exclude",
  "summarize","translate","classify","extract","generate","analyze","compare",
  "implement","cite","verify","reject","ignore","prefer","prioritize",
]);

const LOW_SIGNAL_WORDS = new Set([
  "please","kindly","just","really","very","quite","rather","actually","basically",
  "literally","essentially","simply","helpful","clear","concise","polite","nice",
  "great","wonderful","awesome","perfect","obviously","note","aware",
]);

const STOPWORDS = new Set([
  "a","an","the","of","to","in","on","at","for","with","by","from","is","are","was","were","be","been","being",
  "and","or","but","if","then","else","so","as","than","that","this","these","those","it","its","into","about",
  "i","you","we","they","he","she","them","us","me","him","her","my","your","our","their","his","hers",
  "do","does","did","done","have","has","had","not","no","can","could","would","should","will","may","might",
  "what","which","who","whom","when","where","why","how",
]);

export type WordScore = {
  word: string;
  raw: string; // word with its original casing/punctuation
  score: number; // 0..1
  bucket: "high" | "med" | "low";
  reason: string;
};

export type InfluenceResult = {
  words: WordScore[];
  averageScore: number;
  highCount: number;
  lowCount: number;
};

function classifyWord(raw: string, prevWord: string | null): WordScore {
  // strip surrounding punctuation but keep the original for rendering
  const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const lower = word.toLowerCase();

  if (!word) {
    return { word, raw, score: 0, bucket: "low", reason: "punctuation" };
  }

  // numbers — almost always informative
  if (/^\d+([.,]\d+)?%?$/.test(word)) {
    return { word, raw, score: 0.95, bucket: "high", reason: "numeric value" };
  }

  // code-ish tokens
  if (/[_${}<>=]/.test(word) || /^\w+\(\)?$/.test(word)) {
    return { word, raw, score: 0.85, bucket: "high", reason: "code-like token" };
  }

  if (HIGH_SIGNAL_VERBS.has(lower)) {
    return { word, raw, score: 0.9, bucket: "high", reason: "instruction verb" };
  }

  if (LOW_SIGNAL_WORDS.has(lower)) {
    return { word, raw, score: 0.05, bucket: "low", reason: "filler / politeness" };
  }

  if (STOPWORDS.has(lower)) {
    return { word, raw, score: 0.15, bucket: "low", reason: "stopword" };
  }

  // proper noun heuristic (capitalized mid-sentence after a non-period prev)
  const isProper =
    /^[A-Z][a-z]+/.test(word) &&
    prevWord !== null &&
    !/[.!?]$/.test(prevWord);
  if (isProper) {
    return { word, raw, score: 0.75, bucket: "high", reason: "named entity (proper noun)" };
  }

  // generic length-driven weighting — longer content words tend to be more meaningful
  const length = word.length;
  if (length >= 8) {
    return { word, raw, score: 0.65, bucket: "high", reason: "content-bearing term" };
  }
  if (length >= 5) {
    return { word, raw, score: 0.45, bucket: "med", reason: "mid-weight term" };
  }
  return { word, raw, score: 0.3, bucket: "med", reason: "short term" };
}

export function scoreInfluence(text: string): InfluenceResult {
  // Split preserving whitespace and punctuation as tokens
  const rawTokens = text.match(/\s+|[^\s]+/g) ?? [];
  const words: WordScore[] = [];
  let prev: string | null = null;
  let sum = 0;
  let count = 0;
  let highCount = 0;
  let lowCount = 0;

  for (const t of rawTokens) {
    if (/^\s+$/.test(t)) {
      words.push({ word: "", raw: t, score: 0, bucket: "low", reason: "whitespace" });
      continue;
    }
    const ws = classifyWord(t, prev);
    words.push(ws);
    if (ws.word) {
      sum += ws.score;
      count += 1;
      if (ws.bucket === "high") highCount += 1;
      if (ws.bucket === "low") lowCount += 1;
    }
    prev = t;
  }

  return {
    words,
    averageScore: count > 0 ? sum / count : 0,
    highCount,
    lowCount,
  };
}
