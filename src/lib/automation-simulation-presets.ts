import type { AutomationRuleTrigger } from "@prisma/client";

export type SimulationPayloadPreset = { id: string; label: string; json: string };

/** Variabili di default per simulazione (oltre al merge con JSON custom). */
export function defaultSimulationVarsForTrigger(trigger: AutomationRuleTrigger): Record<string, string> {
  const now = new Date().toISOString();
  const base: Record<string, string> = {
    trigger,
    createdAt: now,
    url: "https://app.example/admin",
    clientId: "demo-client-id",
    clientName: "Demo Client SRL",
    subject: "Titolo esempio",
    label: "Etichetta esempio",
    contactName: "Mario Rossi",
    email: "mario.rossi@example.com",
    phone: "+39 333 1234567",
    source: "WEB",
    priority: "HIGH",
    amountEur: "1250.50",
    platform: "INSTAGRAM",
  };

  switch (trigger) {
    case "POST_APPROVED":
      return { ...base, platform: "INSTAGRAM", label: "Post social approvato" };
    case "LEAD_CREATED":
      return { ...base, subject: "Lead da form referente", source: "REFERRAL" };
    case "TICKET_CREATED":
      return { ...base, subject: "Richiesta assistenza sito", priority: "MEDIUM" };
    case "FINANCE_OVERDUE_SNAPSHOT":
      return { ...base, label: "Snapshot scaduti", amountEur: "0" };
    case "REACH_DRAFT_SENT":
      return { ...base, subject: "Campagna Reach inviata", label: "Sequenza demo" };
    case "FINANCE_INCOME_CREATED":
      return { ...base, amountEur: "890", label: "Fattura saldata" };
    case "WHATSAPP_INBOUND":
      return { ...base, phone: "+393331234567", label: "Messaggio WhatsApp", subject: "WA inbound" };
    default:
      return base;
  }
}

export function simulationPayloadPresetsForTrigger(trigger: AutomationRuleTrigger): SimulationPayloadPreset[] {
  const common: SimulationPayloadPreset[] = [
    { id: "empty", label: "— Solo default trigger —", json: "" },
    { id: "custom", label: "… Incolla JSON personalizzato (prompt)", json: "__CUSTOM__" },
  ];

  const byTrigger: Record<AutomationRuleTrigger, SimulationPayloadPreset[]> = {
    POST_APPROVED: [
      { id: "ig", label: "Post Instagram", json: '{"platform":"INSTAGRAM","label":"Reel promo"}' },
      { id: "fb", label: "Post Facebook", json: '{"platform":"FACEBOOK","label":"Carosello"}' },
    ],
    LEAD_CREATED: [
      { id: "lead-web", label: "Lead web", json: '{"source":"WEB","subject":"Richiesta preventivo","email":"lead@co.it"}' },
      { id: "lead-ref", label: "Lead referral", json: '{"source":"REFERRAL","subject":"Segnalazione","phone":"+39333"}' },
    ],
    TICKET_CREATED: [
      { id: "tic-1", label: "Ticket standard", json: '{"subject":"Bug checkout","priority":"HIGH"}' },
    ],
    FINANCE_OVERDUE_SNAPSHOT: [
      { id: "ov-1", label: "Snapshot", json: '{"label":"OVERDUE_SYNC","amountEur":"0"}' },
    ],
    REACH_DRAFT_SENT: [
      { id: "reach-1", label: "Bozza inviata", json: '{"subject":"Newsletter Q1","label":"Seq. clienti attivi"}' },
    ],
    FINANCE_INCOME_CREATED: [
      { id: "inc-1", label: "Entrata", json: '{"amountEur":"1500","label":"Fattura 12/2026"}' },
    ],
    WHATSAPP_INBOUND: [
      { id: "wa-1", label: "Messaggio WA", json: '{"phoneFrom":"393331234567","body":"Richiesta info"}' },
    ],
  };

  return [...byTrigger[trigger], ...common];
}
