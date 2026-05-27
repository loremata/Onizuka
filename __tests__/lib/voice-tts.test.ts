import { isOpenAiTtsConfigured, voiceTtsProvider } from "@/lib/voice-tts";

describe("voice-tts", () => {
  const prevKey = process.env.OPENAI_API_KEY;
  const prevProvider = process.env.VOICE_TTS_PROVIDER;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
    if (prevProvider === undefined) delete process.env.VOICE_TTS_PROVIDER;
    else process.env.VOICE_TTS_PROVIDER = prevProvider;
  });

  it("detects OpenAI key", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isOpenAiTtsConfigured()).toBe(true);
  });

  it("returns browser when no key", () => {
    delete process.env.OPENAI_API_KEY;
    expect(voiceTtsProvider()).toBe("browser");
  });

  it("returns openai when key present", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(voiceTtsProvider()).toBe("openai");
  });
});
