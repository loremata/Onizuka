import type { AdminNavItem } from "@/components/onizuka/admin-nav-links";

export type AdminToolNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/**
 * Voci «Strumenti» raggruppate per AREA DI LAVORO (job-to-be-done), non per tipo di tabella.
 * Riorganizzazione 27/06/2026 — vedi Onizuka-Riorganizzazione_Moduli-e-Menu.md.
 */
export const ADMIN_TOOL_NAV_GROUPS: AdminToolNavGroup[] = [
  {
    id: "clienti",
    label: "Clienti & CRM",
    items: [
      { href: "/admin/clients", label: "Clienti" },
      { href: "/admin/crm/leads", label: "Prospect / Lead" },
      { href: "/admin/crm/leads/quick", label: "Lead banco" },
      { href: "/admin/crm/pipeline", label: "Pipeline" },
      { href: "/admin/crm/people", label: "Persone" },
      { href: "/admin/crm/contacts", label: "Contatti" },
      { href: "/admin/crm/database", label: "Segmenti & database" },
      { href: "/admin/crm/cross-sell", label: "Cross-sell" },
      { href: "/admin/crm/health-radar", label: "Salute portafoglio" },
      { href: "/admin/crm/dormant", label: "Dormienti" },
      { href: "/admin/crm/renewals", label: "Rinnovi retail" },
      { href: "/admin/crm/referrers", label: "Segnalatori" },
    ],
  },
  {
    id: "vendite",
    label: "Vendite",
    items: [
      { href: "/admin/crm/opportunities", label: "Opportunità" },
      { href: "/admin/crm/opportunity-bottlenecks", label: "SLA opportunità" },
      { href: "/admin/audit/digital", label: "Audit digitale" },
      { href: "/admin/reach", label: "Outreach (Reach)" },
      { href: "/admin/reach/sequences", label: "Sequenze" },
      { href: "/admin/crm/commercial", label: "Dashboard commerciale" },
      { href: "/admin/sales/brands", label: "Brand" },
    ],
  },
  {
    id: "finanza",
    label: "Finanza",
    items: [
      { href: "/admin/finance", label: "Finance (voci)" },
      { href: "/admin/economics", label: "MRR / Economics" },
      { href: "/admin/insights/revenue-at-risk", label: "Revenue at risk" },
      { href: "/admin/reports/service-activations", label: "Attivazioni servizi" },
      { href: "/admin/time", label: "Time" },
    ],
  },
  {
    id: "operazioni",
    label: "Operazioni",
    items: [
      { href: "/admin/flow", label: "Flow / Task" },
      { href: "/admin/calendar", label: "Calendario" },
      { href: "/admin/posts", label: "Contenuti" },
      { href: "/admin/social", label: "Social Pro" },
      { href: "/admin/approvals", label: "Approvazioni contenuti" },
      { href: "/admin/automation-rules", label: "Automazioni" },
      { href: "/admin/webhooks", label: "Webhook n8n" },
      { href: "/admin/documents", label: "Documenti" },
    ],
  },
  {
    id: "caring",
    label: "Caring",
    items: [
      { href: "/admin/client-portal/tickets", label: "Ticket" },
      { href: "/admin/client-portal", label: "Portale cliente" },
    ],
  },
  {
    id: "ai",
    label: "Intelligence & AI",
    items: [
      { href: "/admin/memory", label: "Memoria" },
      { href: "/admin/chat", label: "Chat assistente" },
      { href: "/admin/intelligence", label: "Intelligence (NBA)" },
      { href: "/admin/insights", label: "Insights" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { href: "/admin/settings", label: "Impostazioni" },
      { href: "/admin/users", label: "Utenti" },
      { href: "/admin/search", label: "Ricerca globale" },
      { href: "/admin/regia-operativa", label: "Regia operativa" },
      { href: "/admin/activity", label: "Attività" },
      { href: "/admin/audit", label: "Audit log" },
      { href: "/admin/crm/dedupe", label: "Dedupe CRM" },
      { href: "/admin/crm/analytics", label: "Analytics lead" },
      { href: "/admin/crm/bottlenecks", label: "Bottleneck lead" },
      { href: "/admin/notifications", label: "Notifiche" },
      { href: "/admin/voice", label: "Voice" },
      { href: "/admin/go-live", label: "Go-live" },
    ],
  },
];
