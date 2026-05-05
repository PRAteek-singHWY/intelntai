// Cloud Run picks up stdout/stderr as structured logs when the line is JSON.
// One helper, one shape — keeps the API route uncluttered.

type Level = "info" | "warn" | "error";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    severity: level.toUpperCase(),
    event,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}
