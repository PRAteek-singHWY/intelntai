import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { compressRuleBased, type CompressResult } from "@/lib/compress";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  prompt: string;
  mode?: "rules" | "ai" | "both";
};

type Response = {
  rules: CompressResult;
  ai?: {
    compressed: string;
    notes: string[];
  } | null;
  aiError?: string;
};

const SYSTEM_PROMPT = `You are a prompt compression engine. Your only job is to rewrite the user's prompt to use FEWER tokens while preserving 100% of the semantic intent, all named entities, all numeric values, and all formatting requirements.

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

async function aiCompress(prompt: string): Promise<{ compressed: string; notes: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("");

  // The model sometimes wraps JSON in fences anyway — strip them.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  let parsed: { compressed: string; notes?: string[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fall back: treat entire response as the compressed text.
    return { compressed: cleaned, notes: [] };
  }
  return {
    compressed: parsed.compressed ?? "",
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  };
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").toString();
  if (!prompt.trim()) {
    return NextResponse.json({ error: "Prompt is empty" }, { status: 400 });
  }
  if (prompt.length > 50_000) {
    return NextResponse.json({ error: "Prompt too large (>50k chars)" }, { status: 413 });
  }

  const mode = body.mode ?? "rules";
  const rules = compressRuleBased(prompt);

  const response: Response = { rules };

  if (mode === "ai" || mode === "both") {
    try {
      response.ai = await aiCompress(prompt);
    } catch (err) {
      response.ai = null;
      response.aiError =
        err instanceof Error ? err.message : "AI compression failed";
    }
  }

  return NextResponse.json(response);
}
