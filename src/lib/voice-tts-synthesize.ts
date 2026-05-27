import {
  isElevenLabsTtsConfigured,
  resolveElevenLabsVoiceId,
  synthesizeElevenLabsTts,
} from "@/lib/voice-tts-elevenlabs";
import {
  isOpenAiTtsConfigured,
  resolveOpenAiTtsVoice,
  synthesizeOpenAiTts,
  voiceTtsProvider,
} from "@/lib/voice-tts";

export type CloudTtsResult =
  | { ok: true; buffer: Buffer; fromCache?: boolean; provider: "openai" | "elevenlabs" }
  | { ok: false; error: string };

/** Sintesi cloud secondo VOICE_TTS_PROVIDER (elevenlabs > openai). */
export async function synthesizeCloudTts(text: string): Promise<CloudTtsResult> {
  const provider = voiceTtsProvider();
  if (provider === "elevenlabs" && isElevenLabsTtsConfigured()) {
    const el = await synthesizeElevenLabsTts(text);
    if (el.ok) return el;
    if (isOpenAiTtsConfigured()) {
      const oa = await synthesizeOpenAiTts(text);
      if (oa.ok) return { ...oa, provider: "openai" };
      return el;
    }
    return el;
  }

  if (provider === "openai" || isOpenAiTtsConfigured()) {
    const oa = await synthesizeOpenAiTts(text);
    if (oa.ok) return { ...oa, provider: "openai" };
    if (isElevenLabsTtsConfigured()) {
      return synthesizeElevenLabsTts(text);
    }
    return oa;
  }

  return { ok: false, error: "TTS cloud non configurato (OPENAI_API_KEY o ELEVENLABS_API_KEY)." };
}

export function cloudTtsProviderLabel(): string {
  const p = voiceTtsProvider();
  if (p === "elevenlabs") return "ElevenLabs";
  if (p === "openai") return "OpenAI";
  return "browser";
}

export function cloudTtsVoiceHint(): string {
  if (voiceTtsProvider() === "elevenlabs") {
    return resolveElevenLabsVoiceId() ?? "voice id";
  }
  return resolveOpenAiTtsVoice();
}
