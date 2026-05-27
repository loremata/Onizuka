export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Completamento chat OpenAI-compatible (opzionale). */
export async function chatCompletion(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const base = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";

  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens ?? 400,
      temperature: 0.3,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? null;
}

export function isEmbeddingConfigured(): boolean {
  return isLlmConfigured() && process.env.ONIZUKA_EMBEDDINGS !== "0";
}

/** Embedding OpenAI-compatible per RAG memoria. */
export async function createEmbedding(text: string): Promise<number[] | null> {
  if (!isEmbeddingConfigured()) return null;

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
  const base = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const input = text.trim().slice(0, 8000);
  if (!input) return null;

  const res = await fetch(`${base.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  return json.data?.[0]?.embedding ?? null;
}
