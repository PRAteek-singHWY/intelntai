// Vertex AI Gemini compression — uses Application Default Credentials when
// running on Cloud Run, or GEMINI_API_KEY (Google AI Studio) for local dev.
//
// We expose the same shape as the Anthropic path so the API route can
// swap engines without the UI knowing the difference.

import { GoogleGenAI } from "@google/genai";

export type GeminiResult = { compressed: string; notes: string[] };

const SYSTEM_PROMPT = `You are a prompt compression engine. Your only job is to rewrite the user's prompt to use FEWER tokens while preserving 100% of the semantic intent, all named entities, all numeric values, and all formatting requirements.

Rules:
- Strip filler words, politeness, conversational preamble.
- Replace verbose phrases with shorter equivalents.
- Merge redundant instructions.
- Remove duplicate sentences.
- Never add new instructions.
- Never remove technical specs, constraints, or examples that carry signal.
- Preserve code blocks verbatim.

Return strict JSON of the form:
{
  "compressed": "the rewritten prompt",
  "notes": ["short bullet describing each meaningful cut, max 6 bullets"]
}
No prose outside the JSON. No markdown fences.`;

let client: GoogleGenAI | null = null;

function projectId(): string | null {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    null
  );
}

function location(): string {
  return process.env.VERTEX_LOCATION || "us-central1";
}

function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  const project = projectId();
  if (project) {
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location: location(),
    });
  } else if (apiKey) {
    client = new GoogleGenAI({ apiKey });
  } else {
    throw new Error(
      "Gemini not configured — set GOOGLE_CLOUD_PROJECT (Vertex AI) or GEMINI_API_KEY",
    );
  }
  return client;
}

function parseResponse(text: string): GeminiResult {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(cleaned) as {
      compressed?: string;
      notes?: string[];
    };
    return {
      compressed: parsed.compressed ?? cleaned,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    return { compressed: cleaned, notes: [] };
  }
}

export async function geminiCompress(prompt: string): Promise<GeminiResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const ai = getClient();
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
    },
  });
  const text =
    res.text ??
    res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  return parseResponse(text);
}

export function geminiAvailable(): boolean {
  return Boolean(
    projectId() || process.env.GEMINI_API_KEY,
  );
}
