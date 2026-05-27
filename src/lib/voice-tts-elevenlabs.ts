import {
  isVoiceTtsCacheEnabled,
  readVoiceTtsCache,
  voiceTtsCacheKey,
  writeVoiceTtsCache,
} from "@/lib/voice-tts-cache";

export function isElevenLabsTtsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && resolveElevenLabsVoiceId());
}

export function resolveElevenLabsVoiceId(): string | null {
  const id = process.env.ELEVENLABS_VOICE_ID?.trim();
  return id || null;
}

export function resolveElevenLabsModelId(): string {
  return process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
}

/** Sintesi MP3 via ElevenLabs. */
export async function synthesizeElevenLabsTts(
  text: string
): Promise<
  | { ok: true; buffer: Buffer; fromCache?: boolean; provider: "elevenlabs" }
  | { ok: false; error: string }
> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = resolveElevenLabsVoiceId();
  if (!apiKey || !voiceId) {
    return { ok: false, error: "ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID non configurati." };
  }

  const input = text.trim().slice(0, 4000);
  if (!input) return { ok: false, error: "Testo vuoto." };

  const modelId = resolveElevenLabsModelId();
  const cacheKey = voiceTtsCacheKey(`el:${modelId}:${voiceId}:${input}`, "elevenlabs", voiceId);

  const cached = await readVoiceTtsCache(cacheKey);
  if (cached) {
    return { ok: true, buffer: cached, fromCache: true, provider: "elevenlabs" };
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input,
      model_id: modelId,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, error: err.slice(0, 200) || `ElevenLabs HTTP ${res.status}` };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await writeVoiceTtsCache(cacheKey, buffer);
  return { ok: true, buffer, fromCache: false, provider: "elevenlabs" };
}
