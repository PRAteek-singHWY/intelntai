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
import { COMPRESSION_SYSTEM_PROMPT, parseCompressionJson } from "@/lib/prompts";
import { validateBody, type Mode } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export type AiResult = { compressed: string; notes: string[] };

type Response = {
  rules: CompressResult;
  ai?: AiResult | null;
  gemini?: AiResult | null;
  aiError?: string;
  geminiError?: string;
  cache?: "hit" | "miss";
};

// --- Claude path -------------------------------------------------------

async function aiCompress(prompt: string): Promise<AiResult> {
  const apiKey = await getAnthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: COMPRESSION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  recordSpend(msg.usage.input_tokens, msg.usage.output_tokens);

  const text = msg.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("");

  return parseCompressionJson(text);
}

type EngineOutcome =
  | { result: AiResult; cache: "hit" | "miss" }
  | { error: string };

async function runClaude(prompt: string, ip: string, mode: Mode): Promise<EngineOutcome> {
  const key = cacheKey(["ai", prompt]);
  const cached = cacheGet<AiResult>(key);
  if (cached) {
    log("info", "compress", { ip, mode, cache: "hit", chars: prompt.length });
    return { result: cached, cache: "hit" };
  }
  if (!spendAllowed()) {
    log("warn", "spend_cap_hit", { ip, ...spendStats() });
    return { error: "Daily AI budget exhausted — try again tomorrow or use rules mode." };
  }
  try {
    const ai = await aiCompress(prompt);
    cacheSet(key, ai);
    log("info", "compress", {
      ip,
      mode,
      cache: "miss",
      chars: prompt.length,
      ...spendStats(),
    });
    return { result: ai, cache: "miss" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI compression failed";
    log("error", "ai_compress_failed", { ip, error: msg });
    return { error: msg };
  }
}

// --- Gemini path -------------------------------------------------------

async function runGemini(prompt: string, ip: string, mode: Mode): Promise<EngineOutcome> {
  if (!geminiAvailable()) {
    return {
      error:
        "Gemini not configured — set GOOGLE_CLOUD_PROJECT (Vertex AI) or GEMINI_API_KEY.",
    };
  }
  const key = cacheKey(["gemini", prompt]);
  const cached = cacheGet<AiResult>(key);
  if (cached) {
    log("info", "gemini_compress", { ip, mode, cache: "hit" });
    return { result: cached, cache: "hit" };
  }
  try {
    const g = await geminiCompress(prompt);
    cacheSet(key, g);
    log("info", "gemini_compress", { ip, mode, cache: "miss" });
    return { result: g, cache: "miss" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gemini compression failed";
    log("error", "gemini_compress_failed", { ip, error: msg });
    return { error: msg };
  }
}

// --- Handler -----------------------------------------------------------

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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateBody(raw);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }
  const { prompt, mode } = validated;

  const rules = compressRuleBased(prompt);
  const response: Response = { rules };
  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": String(limit.remaining),
  };

  const wantsClaude = mode === "ai" || mode === "both" || mode === "all";
  const wantsGemini = mode === "gemini" || mode === "all";

  if (wantsClaude) {
    const outcome = await runClaude(prompt, ip, mode);
    if ("error" in outcome) {
      response.ai = null;
      response.aiError = outcome.error;
    } else {
      response.ai = outcome.result;
      response.cache = outcome.cache;
      headers["X-Cache"] = outcome.cache === "hit" ? "HIT" : "MISS";
    }
  }

  if (wantsGemini) {
    const outcome = await runGemini(prompt, ip, mode);
    if ("error" in outcome) {
      response.gemini = null;
      response.geminiError = outcome.error;
    } else {
      response.gemini = outcome.result;
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
