// Request body validation for the /api/compress route.
// Lives outside the route handler so it can be unit-tested without booting
// Next.js (raw `node --test` can't resolve `next/server`).

export const MODES = ["rules", "ai", "gemini", "both", "all"] as const;
export type Mode = (typeof MODES)[number];

export type ValidatedBody = { prompt: string; mode: Mode };

export type ValidationError = { error: string; status: number };

export const MAX_PROMPT_CHARS = 50_000;

function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

export function validateBody(raw: unknown): ValidatedBody | ValidationError {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid JSON body", status: 400 };
  }
  const body = raw as { prompt?: unknown; mode?: unknown };
  const prompt = (body.prompt ?? "").toString();
  if (!prompt.trim()) return { error: "Prompt is empty", status: 400 };
  if (prompt.length > MAX_PROMPT_CHARS) {
    return { error: "Prompt too large (>50k chars)", status: 413 };
  }
  if (body.mode !== undefined && !isMode(body.mode)) {
    return {
      error: `Invalid mode — expected one of: ${MODES.join(", ")}`,
      status: 400,
    };
  }
  return { prompt, mode: (body.mode as Mode) ?? "rules" };
}
