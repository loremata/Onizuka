import { buildFirstAuditOutreachEmail } from "@/lib/audit-outreach-draft";

describe("buildFirstAuditOutreachEmail", () => {
  it("uses brand template when slug known", () => {
    const { subject, body } = buildFirstAuditOutreachEmail({
      companyName: "Demo Srl",
      priorityProblem: "SEO locale debole",
      brandSlug: "labseven",
      brandName: "LabSeven",
      serviceName: "SEO",
      overallScore: 42,
    });
    // La ragione sociale viene ridotta al nome commerciale (nomeCommerciale):
    // "Demo Srl" diventa "Demo". Scrivere la forma giuridica in oggetto fa
    // sembrare la mail una visura, non qualcuno che ha guardato il sito.
    expect(subject).toContain("Demo");
    expect(subject).not.toMatch(/\bS\.?r\.?l\.?\b/i);
    expect(body).toContain("LabSeven");
    expect(body).toContain("42/100");
  });

  it("builds a structured gap→consequence→solution email without internal brands", () => {
    const { subject, body } = buildFirstAuditOutreachEmail({
      companyName: "Pizzeria Roma",
      priorityProblem: "Sito assente",
      overallScore: 38,
      findings: [
        {
          gap: "il sito web è assente o poco orientato a generare contatti",
          consequence: "chi vi cerca online non trova un riferimento credibile",
          solution: "un sito professionale pensato per trasformare le visite in richieste",
        },
        {
          gap: "la presenza sui social è debole o incostante",
          consequence: "il vostro marchio resta poco riconoscibile",
          solution: "un progetto personalizzato di gestione dei social",
        },
      ],
    });
    expect(subject).toContain("Pizzeria Roma");
    expect(subject).toContain("2 aree");
    // Il report è l'esca per la RISPOSTA, non un link (26/08: i token scadono
    // a 30 giorni e i link pesano sulla deliverability delle mail a freddo).
    expect(body).toContain("report");
    expect(body).toContain("rispondere a questa mail");
    expect(body).not.toMatch(/https?:\/\/[^\s]*\/report\//);
    expect(body).toContain("progetto personalizzato di gestione dei social");
    expect(body).toContain("Online Station");
    // nessun brand interno deve trapelare
    expect(body).not.toMatch(/StudioPop|DoctorLead|LabSeven|Brandity/i);
  });

  it("falls back to generic copy without template", () => {
    const { subject, body } = buildFirstAuditOutreachEmail({
      companyName: "Bar",
      priorityProblem: "visibilità",
      brandSlug: "unknown-brand",
    });
    expect(subject).toContain("Bar");
    expect(body).toContain("visibilità");
  });
});
