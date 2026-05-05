import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { compressRuleBased, type CompressResult } from "@/lib/compress";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { cacheGet, cacheSet, cacheKey } from "@/lib/cache";
import { spendAllowed, recordSpend, spendStats } from "@/lib/spend-cap";
import { log } from "@/lib/log";
import { getAnthropicKey } from "@/lib/gcp/secrets";
import { geminiCompress, geminiAvailable } from "@/lib/gcp/gemini";
import { logCompression } from "@/lib/gcp/firestore";
import { countTokens } from "@/lib/tokenizer";

export const runtime = "nodejs";
export const maxDuration = 60;

type Mode = "rules" | "ai" | "gemini" | "both" | "all";

type Body = {
  prompt: string;
  mode?: Mode;
};

type AiResult = { compressed: string; notes: string[] };

type Response = {
  rules: CompressResult;
  ai?: AiResult | null;
  gemini?: AiResult | null;
  aiError?: string;
  geminiError?: string;
  cache?: "hit" | "miss";
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

async function aiCompress(prompt: string): Promise<AiResult> {
  const apiKey = await getAnthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  recordSpend(msg.usage.input_tokens, msg.usage.output_tokens);

  const text = msg.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  let parsed: { compressed: string; notes?: string[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { compressed: cleaned, notes: [] };
  }
  return {
    compressed: parsed.compressed ?? "",
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  };
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const limit = rateLimit(ip);
  if (!limit.ok) {
    log("warn", "rate_limited", { ip, retryAfterSec: limit.retryAfterSec });
    return NextResponse.json(
      { error: "Rate limit exceeded — slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

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

  const mode: Mode = body.mode ?? "rules";
  const rules = compressRuleBased(prompt);
  const response: Response = { rules };
  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": String(limit.remaining),
  };

  const wantsClaude = mode === "ai" || mode === "both" || mode === "all";
  const wantsGemini = mode === "gemini" || mode === "all";

  if (wantsClaude) {
    const key = cacheKey(["ai", prompt]);
    const cached = cacheGet<AiResult>(key);

    if (cached) {
      response.ai = cached;
      response.cache = "hit";
      headers["X-Cache"] = "HIT";
      log("info", "compress", { ip, mode, cache: "hit", chars: prompt.length });
    } else if (!spendAllowed()) {
      response.ai = null;
      response.aiError = "Daily AI budget exhausted — try again tomorrow or use rules mode.";
      log("warn", "spend_cap_hit", { ip, ...spendStats() });
    } else {
      try {
        const ai = await aiCompress(prompt);
        cacheSet(key, ai);
        response.ai = ai;
        response.cache = "miss";
        headers["X-Cache"] = "MISS";
        log("info", "compress", {
          ip,
          mode,
          cache: "miss",
          chars: prompt.length,
          ...spendStats(),
        });
      } catch (err) {
        response.ai = null;
        response.aiError = err instanceof Error ? err.message : "AI compression failed";
        log("error", "ai_compress_failed", { ip, error: response.aiError });
      }
    }
  }

  if (wantsGemini) {
    if (!geminiAvailable()) {
      response.gemini = null;
      response.geminiError =
        "Gemini not configured — set GOOGLE_CLOUD_PROJECT (Vertex AI) or GEMINI_API_KEY.";
    } else {
      const gKey = cacheKey(["gemini", prompt]);
      const gCached = cacheGet<AiResult>(gKey);
      if (gCached) {
        response.gemini = gCached;
        log("info", "gemini_compress", { ip, mode, cache: "hit" });
      } else {
        try {
          const g = await geminiCompress(prompt);
          cacheSet(gKey, g);
          response.gemini = g;
          log("info", "gemini_compress", { ip, mode, cache: "miss" });
        } catch (err) {
          response.gemini = null;
          response.geminiError =
            err instanceof Error ? err.message : "Gemini compression failed";
          log("error", "gemini_compress_failed", { ip, error: response.geminiError });
        }
      }
    }
  }

  if (!wantsClaude && !wantsGemini) {
    log("info", "compress", { ip, mode, chars: prompt.length });
  }

  // Persist a compressed-prompt record to Firestore. We await this so the
  // write completes before Cloud Run can throttle CPU on the function instance,
  // but it's still a no-op when GCP creds are unavailable (e.g., local dev).
  const tokensBefore = countTokens(prompt);
  const tokensAfter = countTokens(rules.compressed);
  const pctSaved =
    tokensBefore > 0 ? ((tokensBefore - tokensAfter) / tokensBefore) * 100 : 0;
  await logCompression({
    ip,
    mode,
    promptPreview: prompt.slice(0, 200),
    promptChars: prompt.length,
    tokensBefore,
    tokensAfter,
    pctSaved: +pctSaved.toFixed(2),
    cache: response.cache ?? "n/a",
  });

  return NextResponse.json(response, { headers });
}
