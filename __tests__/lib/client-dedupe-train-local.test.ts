import { trainDedupeWeightsFromRecords } from "@/lib/client-dedupe-train-local";
import type { DedupeTrainingRecord } from "@/lib/client-dedupe-training";
import { setDedupeModelWeightsCache } from "@/lib/dedupe-model-weights";

describe("trainDedupeWeightsFromRecords", () => {
  beforeEach(() => setDedupeModelWeightsCache(null));

  it("returns weights for duplicate and distinct pairs", () => {
    const records: DedupeTrainingRecord[] = [
      {
        clientAId: "a",
        clientBId: "b",
        label: "duplicate",
        companyA: "Acme Srl",
        companyB: "ACME s.r.l.",
      },
      {
        clientAId: "c",
        clientBId: "d",
        label: "distinct",
        companyA: "Beta Spa",
        companyB: "Gamma Snc",
      },
      {
        clientAId: "e",
        clientBId: "f",
        label: "duplicate",
        companyA: "Studio Rossi",
        companyB: "Rossi Studio",
      },
    ];

    const w = trainDedupeWeightsFromRecords(records, 20);
    expect(w.featureWeights?.cosine).toBeDefined();
    expect(w.dimScale?.length).toBe(256);
    expect(w.dimScale?.every((x) => x >= 0.5 && x <= 2)).toBe(true);
  });
});
