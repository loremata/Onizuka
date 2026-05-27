import { isElevenLabsTtsConfigured } from "@/lib/voice-tts-elevenlabs";
import { voiceTtsProvider } from "@/lib/voice-tts";

describe("voice-tts elevenlabs", () => {
  const prevKey = process.env.ELEVENLABS_API_KEY;
  const prevVoice = process.env.ELEVENLABS_VOICE_ID;
  const prevProvider = process.env.VOICE_TTS_PROVIDER;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = prevKey;
    if (prevVoice === undefined) delete process.env.ELEVENLABS_VOICE_ID;
    else process.env.ELEVENLABS_VOICE_ID = prevVoice;
    if (prevProvider === undefined) delete process.env.VOICE_TTS_PROVIDER;
    else process.env.VOICE_TTS_PROVIDER = prevProvider;
  });

  it("detects elevenlabs when configured", () => {
    process.env.ELEVENLABS_API_KEY = "key";
    process.env.ELEVENLABS_VOICE_ID = "voice123";
    expect(isElevenLabsTtsConfigured()).toBe(true);
  });

  it("prefers elevenlabs when provider set", () => {
    process.env.VOICE_TTS_PROVIDER = "elevenlabs";
    process.env.ELEVENLABS_API_KEY = "key";
    process.env.ELEVENLABS_VOICE_ID = "voice123";
    expect(voiceTtsProvider()).toBe("elevenlabs");
  });
});
