// In-memory IP rate limiter (token bucket).
// Per Cloud Run instance — fine for hackathon-scale traffic; for multi-region
// or high-RPS production this should move to Upstash / Vercel KV.

type Bucket = { tokens: number; updated: number };

const BUCKETS = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function rateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const refillRate = MAX_PER_WINDOW / WINDOW_MS;

  const prev = BUCKETS.get(ip) ?? { tokens: MAX_PER_WINDOW, updated: now };
  const elapsed = now - prev.updated;
  const tokens = Math.min(MAX_PER_WINDOW, prev.tokens + elapsed * refillRate);

  if (tokens < 1) {
    BUCKETS.set(ip, { tokens, updated: now });
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((1 - tokens) / refillRate / 1000),
    };
  }

  BUCKETS.set(ip, { tokens: tokens - 1, updated: now });
  return { ok: true, remaining: Math.floor(tokens - 1), retryAfterSec: 0 };
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
