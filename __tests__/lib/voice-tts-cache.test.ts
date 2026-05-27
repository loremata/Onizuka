import { voiceTtsCacheKey, isVoiceTtsCacheEnabled } from "@/lib/voice-tts-cache";

describe("voice-tts-cache", () => {
  it("builds stable cache keys", () => {
    const a = voiceTtsCacheKey("ciao", "tts-1", "nova");
    const b = voiceTtsCacheKey("ciao", "tts-1", "nova");
    const c = voiceTtsCacheKey("ciao", "tts-1", "alloy");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("cache enabled by default", () => {
    delete process.env.VOICE_TTS_CACHE;
    expect(isVoiceTtsCacheEnabled()).toBe(true);
  });
});
