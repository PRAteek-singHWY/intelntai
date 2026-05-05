// Firestore-backed prompt history. Fire-and-forget on the API route so
// observability never adds latency to the user request. Falls back to a
// no-op when GCP creds are unavailable (e.g., local dev without ADC).

import { Firestore } from "@google-cloud/firestore";
import { projectId } from "./env.ts";

let db: Firestore | null = null;
let disabled = false;

function getDb(): Firestore | null {
  if (disabled) return null;
  if (db) return db;
  const project = projectId();
  if (!project) {
    disabled = true;
    return null;
  }
  try {
    db = new Firestore({
      projectId: project,
      databaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
    });
    return db;
  } catch {
    disabled = true;
    return null;
  }
}

export type CompressionRecord = {
  ip: string;
  mode: "rules" | "ai" | "gemini" | "both" | "all";
  promptPreview: string;
  promptChars: number;
  tokensBefore: number;
  tokensAfter: number;
  pctSaved: number;
  cache: "hit" | "miss" | "n/a";
};

const COLLECTION = "compressions";

export async function logCompression(record: CompressionRecord): Promise<void> {
  const store = getDb();
  if (!store) {
    console.log(
      JSON.stringify({
        severity: "INFO",
        event: "firestore_skipped",
        reason: "no project / db unavailable",
      }),
    );
    return;
  }
  try {
    await store.collection(COLLECTION).add({ ...record, ts: new Date() });
  } catch (err) {
    const e = err as {
      code?: number;
      details?: string;
      message?: string;
      stack?: string;
    };
    console.error(
      JSON.stringify({
        severity: "ERROR",
        event: "firestore_write_failed",
        code: e.code,
        details: e.details,
        message: e.message,
        stack: e.stack?.split("\n").slice(0, 3).join(" | "),
      }),
    );
  }
}

export async function recentCompressions(limit = 20): Promise<
  (CompressionRecord & { ts: Date })[]
> {
  const store = getDb();
  if (!store) return [];
  try {
    const snap = await store
      .collection(COLLECTION)
      .orderBy("ts", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as CompressionRecord & { ts: { toDate(): Date } };
      return { ...data, ts: data.ts.toDate() };
    });
  } catch {
    return [];
  }
}

export function firestoreAvailable(): boolean {
  return getDb() !== null;
}
