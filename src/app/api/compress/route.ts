import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { recordSpend } from "@/lib/spend-cap";
import { log } from "@/lib/log";
import { getAnthropicKey } from "@/lib/gcp/secrets";
import { geminiCompress, geminiAvailable } from "@/lib/gcp/gemini";
import { logCompression } from "@/lib/gcp/firestore";
import { COMPRESSION_SYSTEM_PROMPT, parseCompressionJson } from "@/lib/prompts";
import { validateBody } from "@/lib/validation";
import { handleCompress, type AiResult } from "@/lib/compress-handler";

export const runtime = "nodejs";
export const maxDuration = 60;

async function claudeCompress(prompt: string): Promise<AiResult> {
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

  const { response, headers } = await handleCompress(
    { prompt: validated.prompt, mode: validated.mode, ip },
    {
      claudeCompress,
      geminiCompress,
      geminiAvailable,
      logCompression,
    },
  );

  return NextResponse.json(response, {
    headers: { ...headers, "X-RateLimit-Remaining": String(limit.remaining) },
  });
}
