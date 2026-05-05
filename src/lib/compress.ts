// Deterministic prompt compression engine.
// Produces a segment list so the UI can render a token-level diff
// (kept / rewritten / removed) and explain why each cut happened.

export type Segment = {
  text: string; // original text from the source prompt
  kind: "kept" | "removed" | "rewritten";
  reason?: string; // human-readable explanation
  replacement?: string; // for "rewritten": the new text to emit
  category?: Category;
};

export type Category =
  | "verbose"
  | "filler"
  | "politeness"
  | "meta"
  | "duplicate"
  | "whitespace";

export type CompressResult = {
  original: string;
  compressed: string;
  segments: Segment[];
  stats: {
    removedCount: number;
    rewrittenCount: number;
    byCategory: Record<Category, number>;
  };
};

type Pattern = {
  regex: RegExp;
  category: Category;
  reason: string;
  replacement?: string; // undefined → not used. "" → remove. text → rewrite.
};

// IMPORTANT: every regex below uses the /g flag. Patterns that include capture
// groups must reference those groups consistently in the replacement.

const PATTERNS: Pattern[] = [
  // --- Verbose phrasing → tighter equivalent ----------------------------
  { regex: /\bin order to\b/gi, replacement: "to", category: "verbose", reason: '"in order to" → "to"' },
  { regex: /\bdue to the fact that\b/gi, replacement: "because", category: "verbose", reason: '"due to the fact that" → "because"' },
  { regex: /\bat this point in time\b/gi, replacement: "now", category: "verbose", reason: '"at this point in time" → "now"' },
  { regex: /\bat the present time\b/gi, replacement: "now", category: "verbose", reason: '"at the present time" → "now"' },
  { regex: /\bfor the purpose of\b/gi, replacement: "to", category: "verbose", reason: '"for the purpose of" → "to"' },
  { regex: /\bin the event that\b/gi, replacement: "if", category: "verbose", reason: '"in the event that" → "if"' },
  { regex: /\bwith regard to\b/gi, replacement: "about", category: "verbose", reason: '"with regard to" → "about"' },
  { regex: /\bwith reference to\b/gi, replacement: "about", category: "verbose", reason: '"with reference to" → "about"' },
  { regex: /\bin spite of the fact that\b/gi, replacement: "although", category: "verbose", reason: '"in spite of the fact that" → "although"' },
  { regex: /\bin spite of\b/gi, replacement: "despite", category: "verbose", reason: '"in spite of" → "despite"' },
  { regex: /\ba large number of\b/gi, replacement: "many", category: "verbose", reason: '"a large number of" → "many"' },
  { regex: /\bthe majority of\b/gi, replacement: "most", category: "verbose", reason: '"the majority of" → "most"' },
  { regex: /\bthe fact that\b/gi, replacement: "that", category: "verbose", reason: '"the fact that" → "that"' },
  { regex: /\beach and every\b/gi, replacement: "every", category: "verbose", reason: '"each and every" → "every"' },
  { regex: /\bany and all\b/gi, replacement: "all", category: "verbose", reason: '"any and all" → "all"' },
  { regex: /\bfirst and foremost\b/gi, replacement: "first", category: "verbose", reason: '"first and foremost" → "first"' },
  { regex: /\babsolutely essential\b/gi, replacement: "essential", category: "verbose", reason: 'redundant intensifier' },
  { regex: /\bcompletely eliminate\b/gi, replacement: "eliminate", category: "verbose", reason: 'redundant intensifier' },
  { regex: /\bend result\b/gi, replacement: "result", category: "verbose", reason: 'redundant pair' },
  { regex: /\bfuture plans\b/gi, replacement: "plans", category: "verbose", reason: 'redundant pair' },
  { regex: /\bpast history\b/gi, replacement: "history", category: "verbose", reason: 'redundant pair' },
  { regex: /\bnew innovation\b/gi, replacement: "innovation", category: "verbose", reason: 'redundant pair' },
  { regex: /\brespond in a clear and concise manner\b/gi, replacement: "be concise", category: "verbose", reason: 'said the same thing twice' },
  { regex: /\bmake sure that you\b/gi, replacement: "", category: "verbose", reason: 'instruction filler' },
  { regex: /\bmake sure to\b/gi, replacement: "", category: "verbose", reason: 'instruction filler' },

  // --- Meta / instruction filler that adds no signal --------------------
  { regex: /\bit is important to note that\b\s*/gi, replacement: "", category: "meta", reason: 'meta filler — does not change instruction' },
  { regex: /\bplease note that\b\s*/gi, replacement: "", category: "meta", reason: 'meta filler' },
  { regex: /\bplease be aware that\b\s*/gi, replacement: "", category: "meta", reason: 'meta filler' },
  { regex: /\bit should be noted that\b\s*/gi, replacement: "", category: "meta", reason: 'meta filler' },
  { regex: /\bas a matter of fact\b\s*/gi, replacement: "", category: "meta", reason: 'meta filler' },
  { regex: /\bneedless to say\b\s*/gi, replacement: "", category: "meta", reason: 'meta filler' },
  { regex: /\bplease ensure that\b\s*/gi, replacement: "", category: "meta", reason: 'meta filler' },
  { regex: /\bI would like you to\s+/gi, replacement: "", category: "meta", reason: 'imperative is shorter — drop preamble' },
  { regex: /\bI'd like you to\s+/gi, replacement: "", category: "meta", reason: 'imperative is shorter — drop preamble' },
  { regex: /\bI want you to\s+/gi, replacement: "", category: "meta", reason: 'imperative is shorter — drop preamble' },
  { regex: /\bI need you to\s+/gi, replacement: "", category: "meta", reason: 'imperative is shorter — drop preamble' },
  { regex: /\bcan you (please\s+)?/gi, replacement: "", category: "meta", reason: 'drop polite request — model still complies' },
  { regex: /\bcould you (please\s+)?/gi, replacement: "", category: "meta", reason: 'drop polite request — model still complies' },

  // --- Politeness ------------------------------------------------------
  { regex: /\bplease\s+/gi, replacement: "", category: "politeness", reason: "models don't need 'please'" },
  { regex: /\bkindly\s+/gi, replacement: "", category: "politeness", reason: "models don't need 'kindly'" },
  { regex: /\bif you don't mind,?\s*/gi, replacement: "", category: "politeness", reason: 'social filler' },
  { regex: /\bif you would,?\s*/gi, replacement: "", category: "politeness", reason: 'social filler' },
  { regex: /\bI would appreciate it if (you would\s+)?/gi, replacement: "", category: "politeness", reason: 'social filler' },
  { regex: /\bthank you (in advance )?(for\s+\w+(\s+\w+)?)?\.?/gi, replacement: "", category: "politeness", reason: 'closing pleasantry' },

  // --- Filler intensifiers --------------------------------------------
  { regex: /\b(really|very|quite|rather|just|actually|basically|literally|essentially|simply)\s+/gi, replacement: "", category: "filler", reason: 'filler intensifier — no semantic load' },
];

function applyPatternToSegment(seg: Segment, pattern: Pattern): Segment[] {
  if (seg.kind !== "kept") return [seg];

  const out: Segment[] = [];
  let lastIdx = 0;
  // Reset regex state — patterns are global.
  pattern.regex.lastIndex = 0;
  for (const match of seg.text.matchAll(pattern.regex)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start > lastIdx) {
      out.push({ text: seg.text.slice(lastIdx, start), kind: "kept" });
    }
    if (pattern.replacement === "" || pattern.replacement == null) {
      out.push({
        text: match[0],
        kind: "removed",
        reason: pattern.reason,
        category: pattern.category,
      });
    } else {
      out.push({
        text: match[0],
        kind: "rewritten",
        reason: pattern.reason,
        replacement: pattern.replacement,
        category: pattern.category,
      });
    }
    lastIdx = end;
  }
  if (lastIdx < seg.text.length) {
    out.push({ text: seg.text.slice(lastIdx), kind: "kept" });
  }
  return out.length > 0 ? out : [seg];
}

function dedupeSentences(segments: Segment[]): Segment[] {
  // Walk the kept-and-rewritten output and find duplicate sentences.
  // We work on the final "compressed text" representation, then map back
  // the duplicate spans into kept segments by splitting them on offsets.
  const compressedText = segments
    .filter((s) => s.kind !== "removed")
    .map((s) => (s.kind === "rewritten" ? s.replacement ?? "" : s.text))
    .join("");

  // Find sentence ranges within compressedText (rough: split on . ! ? \n).
  const sentenceRanges: { start: number; end: number; text: string }[] = [];
  const sentRe = /[^.!?\n]+[.!?]?(?:\s|$)|\n+/g;
  let m: RegExpExecArray | null;
  while ((m = sentRe.exec(compressedText)) !== null) {
    if (!m[0].trim()) continue;
    sentenceRanges.push({ start: m.index, end: m.index + m[0].length, text: m[0].trim() });
  }
  const seen = new Set<string>();
  const dupRanges: { start: number; end: number; text: string }[] = [];
  for (const r of sentenceRanges) {
    const key = r.text.toLowerCase().replace(/\s+/g, " ");
    if (key.length < 12) continue; // ignore trivial
    if (seen.has(key)) dupRanges.push(r);
    else seen.add(key);
  }
  if (dupRanges.length === 0) return segments;

  // Map dup ranges (which are positions in compressedText) back to segments.
  // We walk segments and track cursor in compressedText.
  const out: Segment[] = [];
  let cursor = 0;
  for (const seg of segments) {
    if (seg.kind === "removed") {
      out.push(seg);
      continue;
    }
    const emit = seg.kind === "rewritten" ? seg.replacement ?? "" : seg.text;
    const segStart = cursor;
    const segEnd = cursor + emit.length;
    const overlapping = dupRanges.filter((r) => r.start < segEnd && r.end > segStart);
    if (overlapping.length === 0) {
      out.push(seg);
      cursor = segEnd;
      continue;
    }
    // If the entire segment is inside a dup range, mark it as removed.
    const fullyInside = overlapping.some((r) => r.start <= segStart && r.end >= segEnd);
    if (fullyInside) {
      out.push({
        text: seg.text,
        kind: "removed",
        category: "duplicate",
        reason: "duplicate of an earlier sentence",
      });
    } else {
      // Partial overlap is rare and messy; keep the segment intact.
      out.push(seg);
    }
    cursor = segEnd;
  }
  return out;
}

function collapseWhitespaceInString(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^\s+|\s+$/g, "");
}

export function compressRuleBased(input: string): CompressResult {
  if (!input.trim()) {
    return {
      original: input,
      compressed: "",
      segments: [],
      stats: {
        removedCount: 0,
        rewrittenCount: 0,
        byCategory: {
          verbose: 0,
          filler: 0,
          politeness: 0,
          meta: 0,
          duplicate: 0,
          whitespace: 0,
        },
      },
    };
  }

  let segments: Segment[] = [{ text: input, kind: "kept" }];
  for (const pattern of PATTERNS) {
    segments = segments.flatMap((s) => applyPatternToSegment(s, pattern));
  }
  segments = dedupeSentences(segments);

  // Build compressed string from segments + final whitespace collapse.
  const rawCompressed = segments
    .filter((s) => s.kind !== "removed")
    .map((s) => (s.kind === "rewritten" ? s.replacement ?? "" : s.text))
    .join("");
  const compressed = collapseWhitespaceInString(rawCompressed);

  const byCategory: Record<Category, number> = {
    verbose: 0,
    filler: 0,
    politeness: 0,
    meta: 0,
    duplicate: 0,
    whitespace: 0,
  };
  let removedCount = 0;
  let rewrittenCount = 0;
  for (const s of segments) {
    if (s.kind === "removed") {
      removedCount += 1;
      if (s.category) byCategory[s.category] += 1;
    } else if (s.kind === "rewritten") {
      rewrittenCount += 1;
      if (s.category) byCategory[s.category] += 1;
    }
  }

  return {
    original: input,
    compressed,
    segments,
    stats: { removedCount, rewrittenCount, byCategory },
  };
}
