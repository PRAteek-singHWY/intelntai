// Framework-agnostic orchestration for the /api/compress endpoint.
// Lives outside route.ts so it can be unit-tested without booting Next.js
// and without making live AI calls — the engines are dependency-injected.

import { compressRuleBased, type CompressResult } from "./compress.ts";
import { cacheGet, cacheSet, cacheKey } from "./cache.ts";
import { spendAllowed, spendStats } from "./spend-cap.ts";
import { log } from "./log.ts";
import { countTokens } from "./tokenizer.ts";
import type { Mode } from "./validation.ts";

export type AiResult = { compressed: string; notes: string[] };

export type CompressResponse = {
  rules: CompressResult;
  ai?: AiResult | null;
  gemini?: AiResult | null;
  aiError?: string;
  geminiError?: string;
  cache?: "hit" | "miss";
};

export type FirestoreLogger = (record: {
  ip: string;
  mode: Mode;
  promptPreview: string;
  promptChars: number;
  tokensBefore: number;
  tokensAfter: number;
  pctSaved: number;
  cache: "hit" | "miss" | "n/a";
}) => Promise<void>;

export type CompressDeps = {
  claudeCompress: (prompt: string) => Promise<AiResult>;
  geminiCompress: (prompt: string) => Promise<AiResult>;
  geminiAvailable: () => boolean;
  logCompression: FirestoreLogger;
};

export type CompressInput = {
  prompt: string;
  mode: Mode;
  ip: string;
};

export type CompressOutput = {
  response: CompressResponse;
  headers: Record<string, string>;
};

type EngineOutcome =
  | { result: AiResult; cache: "hit" | "miss" }
  | { error: string };

async function runWithCache(
  prefix: "ai" | "gemini",
  prompt: string,
  ip: string,
  mode: Mode,
  exec: (p: string) => Promise<AiResult>,
  enforceSpendCap: boolean,
): Promise<EngineOutcome> {
  const key = cacheKey([prefix, prompt]);
  const cached = cacheGet<AiResult>(key);
  if (cached) {
    log("info", `${prefix === "ai" ? "compress" : "gemini_compress"}`, {
      ip,
      mode,
      cache: "hit",
      chars: prompt.length,
    });
    return { result: cached, cache: "hit" };
  }
  if (enforceSpendCap && !spendAllowed()) {
    log("warn", "spend_cap_hit", { ip, ...spendStats() });
    return {
      error:
        "Daily AI budget exhausted — try again tomorrow or use rules mode.",
    };
  }
  try {
    const ai = await exec(prompt);
    cacheSet(key, ai);
    log("info", `${prefix === "ai" ? "compress" : "gemini_compress"}`, {
      ip,
      mode,
      cache: "miss",
      chars: prompt.length,
      ...(enforceSpendCap ? spendStats() : {}),
    });
    return { result: ai, cache: "miss" };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : `${prefix === "ai" ? "AI" : "Gemini"} compression failed`;
    log("error", `${prefix}_compress_failed`, { ip, error: msg });
    return { error: msg };
  }
}

export async function handleCompress(
  { prompt, mode, ip }: CompressInput,
  deps: CompressDeps,
): Promise<CompressOutput> {
  const rules = compressRuleBased(prompt);
  const response: CompressResponse = { rules };
  const headers: Record<string, string> = {};

  const wantsClaude = mode === "ai" || mode === "both" || mode === "all";
  const wantsGemini = mode === "gemini" || mode === "all";

  if (wantsClaude) {
    const outcome = await runWithCache(
      "ai",
      prompt,
      ip,
      mode,
      deps.claudeCompress,
      true,
    );
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
    if (!deps.geminiAvailable()) {
      response.gemini = null;
      response.geminiError =
        "Gemini not configured — set GOOGLE_CLOUD_PROJECT (Vertex AI) or GEMINI_API_KEY.";
    } else {
      const outcome = await runWithCache(
        "gemini",
        prompt,
        ip,
        mode,
        deps.geminiCompress,
        false,
      );
      if ("error" in outcome) {
        response.gemini = null;
        response.geminiError = outcome.error;
      } else {
        response.gemini = outcome.result;
      }
    }
  }

  if (!wantsClaude && !wantsGemini) {
    log("info", "compress", { ip, mode, chars: prompt.length });
  }

  // Persist a compressed-prompt record. We await so the write finishes before
  // Cloud Run can throttle CPU on the function instance, but it's a no-op when
  // GCP creds are unavailable (e.g., local dev).
  const tokensBefore = countTokens(prompt);
  const tokensAfter = countTokens(rules.compressed);
  const pctSaved =
    tokensBefore > 0 ? ((tokensBefore - tokensAfter) / tokensBefore) * 100 : 0;
  await deps.logCompression({
    ip,
    mode,
    promptPreview: prompt.slice(0, 200),
    promptChars: prompt.length,
    tokensBefore,
    tokensAfter,
    pctSaved: +pctSaved.toFixed(2),
    cache: response.cache ?? "n/a",
  });

  return { response, headers };
}
