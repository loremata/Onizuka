import { evaluateVoiceAutonomy } from "@/lib/voice-autonomy-policy";

describe("evaluateVoiceAutonomy", () => {
  it("blocks high-risk send commands", () => {
    const r = evaluateVoiceAutonomy("approva email reach");
    expect(r.allowed).toBe(false);
    expect(r.risk).toBe("high");
  });

  it("allows low-risk task", () => {
    const r = evaluateVoiceAutonomy("ricordami di chiamare il cliente");
    expect(r.allowed).toBe(true);
    expect(r.risk).toBe("low");
  });
});
