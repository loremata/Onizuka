-- Embedding vettoriale (float[]) per RAG semantico opzionale (OpenAI).
ALTER TABLE "MemoryItem" ADD COLUMN IF NOT EXISTS "embedding" DOUBLE PRECISION[];
