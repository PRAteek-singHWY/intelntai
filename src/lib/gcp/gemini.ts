// Vertex AI Gemini compression — uses Application Default Credentials when
// running on Cloud Run, or GEMINI_API_KEY (Google AI Studio) for local dev.
//
// We expose the same shape as the Anthropic path so the API route can
// swap engines without the UI knowing the difference.

import { GoogleGenAI } from "@google/genai";
import { projectId } from "./env.ts";
import { COMPRESSION_SYSTEM_PROMPT, parseCompressionJson } from "../prompts.ts";

export type GeminiResult = { compressed: string; notes: string[] };

let client: GoogleGenAI | null = null;

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

export async function geminiCompress(prompt: string): Promise<GeminiResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const ai = getClient();
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: COMPRESSION_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
    },
  });
  const text =
    res.text ??
    res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  return parseCompressionJson(text);
}

export function geminiAvailable(): boolean {
  return Boolean(projectId() || process.env.GEMINI_API_KEY);
}
