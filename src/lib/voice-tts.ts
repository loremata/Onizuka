import {
  readVoiceTtsCache,
  voiceTtsCacheKey,
  writeVoiceTtsCache,
} from "@/lib/voice-tts-cache";
import { isElevenLabsTtsConfigured } from "@/lib/voice-tts-elevenlabs";

/** TTS cloud: OpenAI, ElevenLabs o Web Speech nel browser. */

export function resolveOpenAiTtsVoice(): string {
  return process.env.OPENAI_TTS_VOICE?.trim() || "nova";
}

export function resolveOpenAiTtsModel(): string {
  return process.env.OPENAI_TTS_MODEL?.trim() || "tts-1";
}

export function isOpenAiTtsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function voiceTtsProvider(): "openai" | "elevenlabs" | "browser" {
  const p = process.env.VOICE_TTS_PROVIDER?.trim().toLowerCase();
  if (p === "elevenlabs" && isElevenLabsTtsConfigured()) return "elevenlabs";
  if (p === "openai" && isOpenAiTtsConfigured()) return "openai";
  if (isOpenAiTtsConfigured()) return "openai";
  if (isElevenLabsTtsConfigured()) return "elevenlabs";
  return "browser";
}

/** Sintesi MP3 via OpenAI (max ~4000 caratteri). */
export type SynthesizeOpenAiTtsResult =
  | { ok: true; buffer: Buffer; fromCache?: boolean }
  | { ok: false; error: string };

export async function synthesizeOpenAiTts(text: string): Promise<SynthesizeOpenAiTtsResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { ok: false, error: "OPENAI_API_KEY non configurata." };

  const input = text.trim().slice(0, 4000);
  if (!input) return { ok: false, error: "Testo vuoto." };

  const model = resolveOpenAiTtsModel();
  const voice = resolveOpenAiTtsVoice();
  const cacheKey = voiceTtsCacheKey(input, model, voice);

  const cached = await readVoiceTtsCache(cacheKey);
  if (cached) return { ok: true, buffer: cached, fromCache: true };

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, error: err.slice(0, 200) || `OpenAI TTS HTTP ${res.status}` };
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeVoiceTtsCache(cacheKey, buffer);
  return { ok: true, buffer, fromCache: false };
}
