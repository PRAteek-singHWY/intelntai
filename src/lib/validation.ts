// Request body validation for the /api/compress route.
// Lives outside the route handler so it can be unit-tested without booting
// Next.js (raw `node --test` can't resolve `next/server`).

export type Mode = "rules" | "ai" | "gemini" | "both" | "all";

export type ValidatedBody = { prompt: string; mode: Mode };

export type ValidationError = { error: string; status: number };

const MAX_PROMPT_CHARS = 50_000;

export function validateBody(raw: unknown): ValidatedBody | ValidationError {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid JSON body", status: 400 };
  }
  const body = raw as { prompt?: unknown; mode?: Mode };
  const prompt = (body.prompt ?? "").toString();
  if (!prompt.trim()) return { error: "Prompt is empty", status: 400 };
  if (prompt.length > MAX_PROMPT_CHARS) {
    return { error: "Prompt too large (>50k chars)", status: 413 };
  }
  return { prompt, mode: body.mode ?? "rules" };
}
