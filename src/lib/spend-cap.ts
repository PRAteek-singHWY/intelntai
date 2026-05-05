// Daily spend ceiling — protects the API key on the public Cloud Run URL.
// Tracks approximate input+output tokens billed against Claude Sonnet 4.6
// pricing and rejects new AI calls past the cap.

const DAILY_USD_CAP = Number(process.env.TOKENLY_DAILY_USD_CAP ?? "10");

// Sonnet 4.6 list price (per src/lib/pricing.ts) — kept in-sync manually.
const INPUT_PER_M = 3;
const OUTPUT_PER_M = 15;

let day = currentDay();
let usdSpent = 0;

function currentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollover() {
  const today = currentDay();
  if (today !== day) {
    day = today;
    usdSpent = 0;
  }
}

export function spendRemaining(): number {
  rollover();
  return Math.max(0, DAILY_USD_CAP - usdSpent);
}

export function spendAllowed(): boolean {
  return spendRemaining() > 0;
}

export function recordSpend(inputTokens: number, outputTokens: number): void {
  rollover();
  usdSpent +=
    (inputTokens / 1_000_000) * INPUT_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_PER_M;
}

export function spendStats() {
  rollover();
  return { day, usdSpent: +usdSpent.toFixed(4), capUsd: DAILY_USD_CAP };
}
