import { GoogleGenAI } from "@google/genai";

// Pinned exact snapshot, same reasoning as MODEL in assistant.ts: a "-latest"
// alias could silently swap the vector space out from under already-stored
// embeddings, desyncing old rows from anything generated afterward.
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;
const MAX_INPUT_CHARS = 8000;

/**
 * Generates a semantic embedding for text. Returns null (never throws) on
 * any failure - embeddings are an enhancement layer over the always-working
 * tsvector search (src/lib/knowledge/search.ts falls back to keyword-only
 * results when this returns null), so a missing API key or a transient
 * quota error must never block saving a knowledge article.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const trimmed = text.trim().slice(0, MAX_INPUT_CHARS);
  if (!trimmed) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: trimmed,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    const values = response.embeddings?.[0]?.values;
    return values && values.length === EMBEDDING_DIMENSIONS ? values : null;
  } catch {
    return null;
  }
}
