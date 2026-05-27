import { maxDuplicateScoreInGroup } from "@/lib/dedupe-group-score";

describe("maxDuplicateScoreInGroup", () => {
  it("returns 100 for matching VAT pairs", () => {
    expect(
      maxDuplicateScoreInGroup([
        { companyName: "A Srl", contactEmail: "a@x.it", vatNumber: "IT12345678901" },
        { companyName: "B Srl", contactEmail: "b@x.it", vatNumber: "IT12345678901" },
      ])
    ).toBe(100);
  });

  it("returns 0 for empty group", () => {
    expect(maxDuplicateScoreInGroup([])).toBe(0);
  });
});
