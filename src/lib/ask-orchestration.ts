import { askIntentHref, askIntentLabel, resolveAskIntent, type AskIntent } from "@/lib/ask-onizuka";

export type AskOrchestration = {
  primary: AskIntent;
  primaryHref: string;
  followUps: { label: string; href: string }[];
  summary: string;
};

const FOLLOW_UP_BY_HREF: Record<string, { label: string; href: string }[]> = {
  "/admin/crm/pipeline": [
    { label: "Nuova opportunità", href: "/admin/crm/opportunities/new" },
    { label: "Lead", href: "/admin/crm/leads" },
    { label: "Finance", href: "/admin/finance" },
  ],
  "/admin/flow": [
    { label: "Scadenze oggi", href: "/admin/flow?due=today" },
    { label: "Calendario", href: "/admin/calendar" },
  ],
  "/admin/flow?due=today": [
    { label: "Tutti i task", href: "/admin/flow" },
    { label: "Insights", href: "/admin/insights" },
  ],
  "/admin/clients": [
    { label: "Nuovo cliente", href: "/admin/clients/new" },
    { label: "Ricerca globale", href: "/admin/search" },
  ],
  "/admin/reach": [
    { label: "Nuova bozza email", href: "/admin/reach?new=1" },
    { label: "Lead", href: "/admin/crm/leads" },
  ],
  "/admin/audit": [
    { label: "Clienti", href: "/admin/clients" },
    { label: "Reach", href: "/admin/reach" },
  ],
};

export function orchestrateAsk(raw: string): AskOrchestration {
  const primary = resolveAskIntent(raw);
  const primaryHref = askIntentHref(primary);

  const followUps = FOLLOW_UP_BY_HREF[primaryHref] ?? [
    { label: "Command Center", href: "/admin" },
    { label: "Insights", href: "/admin/insights" },
  ];

  const summary =
    primary.kind === "prospect_vat"
      ? "Avvio pipeline prospect digitale/AI: anagrafica, audit, report, email in Approval Queue."
      : primary.kind === "navigate"
        ? `Apro ${primary.label} e propongo i prossimi passi correlati.`
        : `Cerco ${askIntentLabel(primary)} nell'anagrafica e nei moduli collegati.`;

  return { primary, primaryHref, followUps: followUps.slice(0, 4), summary };
}
