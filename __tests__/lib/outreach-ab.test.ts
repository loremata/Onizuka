import {
  hasOutreachAb,
  hasOutreachBodyAb,
  normalizeAbVariant,
  pickOutreachBody,
  pickOutreachSubject,
  suggestReachAbWinner,
} from "@/lib/outreach-ab";

describe("outreach-ab", () => {
  it("uses subject A by default", () => {
    expect(pickOutreachSubject({ subject: "Ciao", subjectAlt: "Hey" }, "A")).toBe("Ciao");
  });

  it("uses subject B when set", () => {
    expect(pickOutreachSubject({ subject: "Ciao", subjectAlt: "Hey" }, "B")).toBe("Hey");
  });

  it("uses body B when set", () => {
    expect(pickOutreachBody({ body: "Testo A", bodyAlt: "Testo B" }, "B")).toBe("Testo B");
  });

  it("detects ab variant", () => {
    expect(hasOutreachAb({ subjectAlt: "Alt", bodyAlt: "" })).toBe(true);
    expect(hasOutreachBodyAb({ bodyAlt: "x" })).toBe(true);
    expect(hasOutreachAb({ subjectAlt: "" })).toBe(false);
  });

  it("normalizes ab variant", () => {
    expect(normalizeAbVariant("b")).toBe("B");
    expect(normalizeAbVariant("x")).toBe("A");
  });

  it("suggests winner when enough samples", () => {
    expect(
      suggestReachAbWinner({
        abSentA: 5,
        abSentB: 5,
        abOpenRateA: 10,
        abOpenRateB: 40,
        abClickRateA: 0,
        abClickRateB: 5,
      })
    ).toBe("B");
  });

  it("returns null winner with low volume", () => {
    expect(
      suggestReachAbWinner({
        abSentA: 1,
        abSentB: 5,
        abOpenRateA: 100,
        abOpenRateB: 0,
      })
    ).toBeNull();
  });
});
