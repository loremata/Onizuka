/**
 * MVP routing per "Chiedi a Onizuka": keyword → modulo o ricerca globale.
 */

import { isProspectVatCommand } from "@/lib/prospect-vat-command";

export type AskIntent =
  | { kind: "navigate"; href: string; label: string }
  | { kind: "search"; q: string }
  | { kind: "prospect_vat"; command: string; label: string };

const NAV_RULES: { label: string; href: string; patterns: RegExp[] }[] = [
  { label: "Pipeline opportunità", href: "/admin/crm/pipeline", patterns: [/\bpipeline\b/i, /\bopportunit/i, /\btrattativ/i] },
  { label: "Lead CRM", href: "/admin/crm/leads", patterns: [/\blead\b/i] },
  {
    label: "Flow · scadenze oggi",
    href: "/admin/flow?due=today",
    patterns: [/\bscadenz\w*\s+oggi\b/i, /\boggi\b.*\bscadenz/i, /\btask\b.*\boggi\b/i],
  },
  {
    label: "Flow · task in ritardo",
    href: "/admin/flow?due=overdue",
    patterns: [/\bscadenz\w*\s+(?:scadut|ritard)/i, /\bin\s+ritardo\b/i, /\boverdue\b/i],
  },
  {
    label: "Flow · task",
    href: "/admin/flow",
    patterns: [/\bflow\b/i, /\btask\b/i, /\burgen/i],
  },
  { label: "Memoria", href: "/admin/memory", patterns: [/\bmemori/i, /\bnota\b/i, /\bappunt/i] },
  {
    label: "Asset clienti",
    href: "/admin/clients",
    patterns: [/\basset\b/i, /\bcanali\b/i, /\bprofil\w*\s+social/i],
  },
  { label: "Calendario", href: "/admin/calendar", patterns: [/\bcalendari/i, /\bagend/i, /\bappuntament/i] },
  { label: "Insights", href: "/admin/insights", patterns: [/\binsight/i, /\bkpi\b/i, /\bpriorit\w*\s+oggi/i] },
  { label: "Finance", href: "/admin/finance", patterns: [/\bfinanz/i, /\bcashflow/i, /\bfattur/i, /\bincass/i] },
  { label: "Reach", href: "/admin/reach", patterns: [/\breach\b/i, /\boutreach/i, /\bfollow-?up/i] },
  {
    label: "Approval Queue",
    href: "/admin/approvals",
    patterns: [/\bapproval\b/i, /\bcoda\s+approv/i, /\bda\s+approvare\b/i],
  },
  {
    label: "Cross-sell",
    href: "/admin/crm/cross-sell",
    patterns: [
      /\bcross-?sell\b/i,
      /\bupsell\b/i,
      /\bstudiopop\b.*\bads\b/i,
      /\bfibra\b.*\btim\s*vision\b/i,
    ],
  },
  {
    label: "Economics per brand",
    href: "/admin/economics",
    patterns: [/\beconomics\b/i, /\bmargini\b/i, /\bper\s+brand\b/i],
  },
  { label: "Documenti", href: "/admin/documents", patterns: [/\bdocumenti\b/i, /\barchivio\s+file/i] },
  {
    label: "Punto della situazione",
    href: "/admin",
    patterns: [/\bpunto\b.*\bsituaz/i, /\bsituazione\s+oggi\b/i],
  },
  {
    label: "Rinnovi in scadenza",
    href: "/admin/crm/renewals",
    patterns: [/\brinnovi\b/i, /\brinnovo\b/i],
  },
  {
    label: "Clienti da ricontattare",
    href: "/admin/crm/dormant",
    patterns: [/\bricontatt/i, /\bdormient/i],
  },
  {
    label: "Audit digitale",
    href: "/admin/audit/digital",
    patterns: [/\baudit\b/i, /\banalizz\w*\s+(?:questa\s+)?partita/i],
  },
  { label: "Audit log", href: "/admin/audit", patterns: [/\bregistr/i, /\battivit\w*\s+recent/i, /\blog\s+audit/i] },
  { label: "Sales", href: "/admin/sales", patterns: [/\bsales\b/i, /\bvendit/i, /\bcommerciale\b/i] },
  { label: "Drive", href: "/admin/drive", patterns: [/\bdrive\b/i, /\bdocument/i, /\bfile\b/i, /\bcartell/i] },
  { label: "Ricerca globale", href: "/admin/search", patterns: [/\bricerc\w*\s+global/i, /\bcerca\s+ovunque/i] },
  {
    label: "Post e approvazioni",
    href: "/admin/posts",
    patterns: [/\bpost\b/i, /\bcontenut/i, /\bapprov/i, /\bsocial\b/i],
  },
  { label: "Webhook", href: "/admin/webhooks", patterns: [/\bwebhook/i, /\bn8n\b/i, /\bautomaz/i] },
  {
    label: "Go-live",
    href: "/admin/go-live",
    patterns: [/\bgo-?live\b/i, /\bdeploy\b/i, /\bproduzion/i, /\bonizuka\.it\b/i],
  },
  {
    label: "Cambia password",
    href: "/admin/account/password",
    patterns: [/\bpassword\b/i, /\bcambia\s+pass/i],
  },
  { label: "Impostazioni", href: "/admin/settings", patterns: [/\bimpostaz/i, /\bsettings?\b/i, /\bfuso\b/i, /\btimezone\b/i] },
  { label: "Utenti", href: "/admin/users", patterns: [/\butent/i, /\baccount\b/i] },
  {
    label: "Clienti",
    href: "/admin/clients",
    patterns: [/\bclienti\b/i, /\banagrafic/i],
  },
];

function normalizeAsk(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Estrae testo dopo verbi tipo "cerca", "trova", "mostra". */
function extractSearchQuery(input: string): string | null {
  const m = input.match(/^(?:cerca|trova|mostra|dammi|elenca)\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export function resolveAskIntent(raw: string): AskIntent {
  const input = normalizeAsk(raw);
  if (!input) {
    return { kind: "navigate", href: "/admin", label: "Command Center" };
  }

  if (isProspectVatCommand(input)) {
    return {
      kind: "prospect_vat",
      command: input,
      label: "Prospect digitale/AI da P.IVA",
    };
  }

  const explicitSearch = extractSearchQuery(input);
  if (explicitSearch) {
    return { kind: "search", q: explicitSearch };
  }

  for (const rule of NAV_RULES) {
    if (rule.patterns.some((p) => p.test(input))) {
      if (rule.label === "Clienti") {
        const rest = input.replace(/^(?:clienti?|anagrafica)\s*/i, "").trim();
        if (rest.length >= 2) {
          return { kind: "search", q: rest };
        }
      }
      return { kind: "navigate", href: rule.href, label: rule.label };
    }
  }

  return { kind: "search", q: input };
}

export function askIntentHref(intent: AskIntent): string {
  if (intent.kind === "navigate") return intent.href;
  if (intent.kind === "prospect_vat") return "/admin/approvals";
  return `/admin/search?q=${encodeURIComponent(intent.q)}`;
}

export function askIntentLabel(intent: AskIntent): string {
  if (intent.kind === "navigate") return intent.label;
  if (intent.kind === "prospect_vat") return intent.label;
  return `Ricerca: «${intent.q}»`;
}
