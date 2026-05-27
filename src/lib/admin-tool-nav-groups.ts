import type { AdminNavItem } from "@/components/onizuka/admin-nav-links";

export type AdminToolNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/** Voci «Strumenti» raggruppate per menu a tendina (admin layout). */
export const ADMIN_TOOL_NAV_GROUPS: AdminToolNavGroup[] = [
  {
    id: "crm",
    label: "CRM",
    items: [
      { href: "/admin/crm/leads", label: "Lead" },
      { href: "/admin/crm/pipeline", label: "Pipeline" },
      { href: "/admin/crm/opportunities", label: "Opportunità" },
      { href: "/admin/crm/cross-sell", label: "Cross-sell" },
      { href: "/admin/crm/contacts", label: "Contatti" },
      { href: "/admin/crm/people", label: "Persone" },
      { href: "/admin/crm/analytics", label: "Analytics lead" },
      { href: "/admin/crm/bottlenecks", label: "Bottleneck lead" },
      { href: "/admin/crm/opportunity-bottlenecks", label: "SLA opportunità" },
      { href: "/admin/crm/dormant", label: "Dormienti" },
      { href: "/admin/crm/health-radar", label: "Health radar" },
      { href: "/admin/crm/renewals", label: "Rinnovi retail" },
      { href: "/admin/crm/leads/quick", label: "Lead banco" },
      { href: "/admin/crm/dedupe", label: "Dedupe CRM" },
      { href: "/admin/crm/referrers", label: "Segnalatori" },
    ],
  },
  {
    id: "commercial",
    label: "Commerciale",
    items: [
      { href: "/admin/audit", label: "Audit log" },
      { href: "/admin/audit/digital", label: "Audit digitale" },
      { href: "/admin/reach", label: "Reach" },
      { href: "/admin/reach/sequences", label: "Sequenze" },
      { href: "/admin/crm/commercial", label: "Dashboard commerciale" },
      { href: "/admin/sales", label: "Sales (legacy)" },
      { href: "/admin/sales/brands", label: "Brand" },
    ],
  },
  {
    id: "ops",
    label: "Operazioni",
    items: [
      { href: "/admin/finance", label: "Finanza" },
      { href: "/admin/economics", label: "Economics" },
      { href: "/admin/time", label: "Time" },
      { href: "/admin/calendar", label: "Calendario" },
      { href: "/admin/documents", label: "Documenti" },
      { href: "/admin/activity", label: "Attività" },
      { href: "/admin/automation-rules", label: "Regole auto" },
      { href: "/admin/webhooks", label: "Webhook n8n" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/admin/intelligence", label: "Intelligence" },
      { href: "/admin/regia-operativa", label: "Regia operativa" },
      { href: "/admin/insights", label: "Insights" },
      { href: "/admin/insights/revenue-at-risk", label: "Revenue at risk" },
      { href: "/admin/reports/service-activations", label: "Attivazioni servizi" },
      { href: "/admin/chat", label: "Chat assistente" },
      { href: "/admin/ai-runs", label: "Esecuzioni AI" },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    items: [
      { href: "/admin/search", label: "Ricerca globale" },
      { href: "/admin/client-portal", label: "Portale cliente" },
      { href: "/admin/client-portal/tickets", label: "Ticket" },
      { href: "/admin/notifications", label: "Notifiche" },
      { href: "/admin/voice", label: "Voice" },
      { href: "/admin/settings", label: "Impostazioni" },
      { href: "/admin/go-live", label: "Go-live" },
    ],
  },
];
