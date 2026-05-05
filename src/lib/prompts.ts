// System prompt shared by every LLM-backed compression engine (Claude, Gemini,
// future providers). Keeping one source of truth means we can tune the
// instruction once and have every backend pick it up.

export const COMPRESSION_SYSTEM_PROMPT = `You are a prompt compression engine. Your only job is to rewrite the user's prompt to use FEWER tokens while preserving 100% of the semantic intent, all named entities, all numeric values, and all formatting requirements.

Rules:
- Strip filler words, politeness, conversational preamble.
- Replace verbose phrases with shorter equivalents.
- Merge redundant instructions.
- Remove duplicate sentences.
- Never add new instructions.
- Never remove technical specs, constraints, or examples that carry signal.
- Preserve code blocks verbatim.

Return strict JSON of the form:
{
  "compressed": "the rewritten prompt",
  "notes": ["short bullet describing each meaningful cut, max 6 bullets"]
}
No prose outside the JSON. No markdown fences.`;

// Both Claude and Gemini sometimes wrap JSON in ```json fences despite our
// instruction. Strip those before JSON.parse so the caller can stay simple.
export function parseCompressionJson(
  text: string,
): { compressed: string; notes: string[] } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(cleaned) as {
      compressed?: string;
      notes?: string[];
    };
    return {
      compressed: parsed.compressed ?? cleaned,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return { compressed: cleaned, notes: [] };
  }
}
