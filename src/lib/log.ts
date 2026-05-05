// Cloud Run picks up stdout/stderr as structured logs when the line is JSON.
// In addition, when CLOUD_LOGGING_ENABLED=1 we also write through the
// @google-cloud/logging client so logs land in a named Cloud Logging log
// (useful for filtering, sinks, alerts).

import type { Logging as LoggingType, Log as CloudLog } from "@google-cloud/logging";

type Level = "info" | "warn" | "error";

const LOG_NAME = process.env.CLOUD_LOG_NAME || "tokenly";

let cloudLog: CloudLog | null = null;
let cloudInitTried = false;

function maybeInitCloudLogging(): CloudLog | null {
  if (cloudInitTried) return cloudLog;
  cloudInitTried = true;
  if (process.env.CLOUD_LOGGING_ENABLED !== "1") return null;
  try {
    // Lazy-require so local dev without ADC never pays the cost.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Logging } = require("@google-cloud/logging") as {
      Logging: new (opts?: { projectId?: string }) => LoggingType;
    };
    const project =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      undefined;
    const logging = new Logging({ projectId: project });
    cloudLog = logging.log(LOG_NAME);
    return cloudLog;
  } catch {
    return null;
  }
}

export function log(
  level: Level,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const payload = {
    severity: level.toUpperCase(),
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else console.log(line);

  const cl = maybeInitCloudLogging();
  if (cl) {
    const severity =
      level === "error" ? "ERROR" : level === "warn" ? "WARNING" : "INFO";
    const entry = cl.entry({ resource: { type: "cloud_run_revision" }, severity }, payload);
    void cl.write(entry).catch(() => {
      // Cloud Logging writes are best-effort; stdout already captured the line.
    });
  }
}
