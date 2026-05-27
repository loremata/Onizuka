import { hasOnizukaWakeWord, stripOnizukaWakePrefix } from "@/lib/voice-wake";

describe("voice wake", () => {
  it("strips wake prefix", () => {
    expect(stripOnizukaWakePrefix("Onizuka, apri finance")).toBe("apri finance");
    expect(stripOnizukaWakePrefix("ehi onizuka ricordami di chiamare")).toBe("ricordami di chiamare");
  });

  it("detects wake word", () => {
    expect(hasOnizukaWakeWord("Onizuka apri flow")).toBe(true);
    expect(hasOnizukaWakeWord("apri flow")).toBe(false);
  });
});
