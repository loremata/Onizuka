import { scoreAudit, type AuditSignals } from "@/lib/audit/scoring";
import { buildEvidenceFindings } from "@/lib/audit-evidence";

/**
 * Il report può dire solo ciò che ha misurato. Quando la scheda Google non viene
 * letta nel dettaglio, orari e foto restano SCONOSCIUTI: prima diventavano
 * `false` e `0`, e la mail a freddo si apriva accusando l'azienda di non avere
 * gli orari pubblicati — a chi li aveva.
 */
function signals(gbp: Partial<AuditSignals["gbp"]>): AuditSignals {
  return {
    hasWebsite: false,
    probe: null,
    psi: null,
    gbp: {
      hasGbp: true,
      rating: 4.5,
      reviewCount: 12,
      categories: ["ristorante"],
      hasHours: null,
      photoCount: null,
      ...gbp,
    },
  };
}

describe("scheda Google non misurata", () => {
  it("non accusa di orari mancanti quando gli orari non sono stati letti", () => {
    const { sections, metrics } = scoreAudit(signals({}));
    const local = sections.find((s) => s.sectionKey === "LOCAL");
    expect(local?.issues ?? "").not.toMatch(/orari/i);
    expect(local?.positives ?? "").not.toMatch(/orari/i);
    expect(buildEvidenceFindings(metrics).map((f) => f.gap).join(" ")).not.toMatch(/orari/i);
  });

  it("non accusa di foto mancanti quando le foto non sono state contate", () => {
    const { sections, metrics } = scoreAudit(signals({}));
    const local = sections.find((s) => s.sectionKey === "LOCAL");
    expect(local?.issues ?? "").not.toMatch(/foto/i);
    expect(buildEvidenceFindings(metrics).map((f) => f.gap).join(" ")).not.toMatch(/foto/i);
  });

  it("lo dice, invece, quando l'ha misurato davvero", () => {
    const { sections } = scoreAudit(signals({ hasHours: false, photoCount: 0 }));
    const local = sections.find((s) => s.sectionKey === "LOCAL");
    expect(local?.issues ?? "").toMatch(/orari/i);
    expect(local?.issues ?? "").toMatch(/foto/i);
  });
});
