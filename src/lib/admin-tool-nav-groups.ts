import type { AdminNavItem } from "@/components/onizuka/admin-nav-links";

export type AdminToolNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

/**
 * Voci «Strumenti» raggruppate per AREA DI LAVORO (job-to-be-done), non per tipo di tabella.
 * Riorganizzazione 26/06/2026 (Fase 3 semplificazione) + revisione 24/07/2026.
 * Le pagine non elencate NON sono state rimosse: sono raggiungibili dai rispettivi hub —
 *  - regia-operativa e crm/commercial: schede dell'hub Insights (AnalyticsHubTabs);
 *  - crm/people: scheda della Rubrica (CrmDirectoryTabs, hub raggiunto da «Clienti»);
 *  - crm/bottlenecks (lead oltre SLA) e crm/opportunity-bottlenecks (opportunità oltre SLA):
 *    pagine distinte, linkate dal pannello Ops del CRM e dal Command Center;
 *  - crm/analytics, crm/leads/quick, webhooks, voice, go-live, approvals: tecniche/occasionali
 *    o già in nav primaria.
 * /admin/automations (control center cron & integrazioni) e /admin/automation-rules (regole
 * in-app) sono pagine con scopi diversi: entrambe in menu con etichette distinte.
 */
export const ADMIN_TOOL_NAV_GROUPS: AdminToolNavGroup[] = [
  {
    id: "clienti",
    label: "Clienti & CRM",
    items: [
      { href: "/admin/clients", label: "Clienti" },
      { href: "/admin/crm/leads", label: "Prospect / Lead" },
      { href: "/admin/crm/scraping", label: "Scraping aziende" },
      { href: "/admin/crm/pipeline", label: "Pipeline" },
      // Rubrica: le schede (Clienti/Contatti/Persone/Segmenti) sono ora sull'hub
      // raggiungibile da "Clienti" — voce di menu separata rimossa per deduplicare.
      { href: "/admin/crm/cross-sell", label: "Cross-sell" },
      { href: "/admin/crm/renewals", label: "Rinnovi retail" },
      { href: "/admin/crm/referrers", label: "Segnalatori" },
      { href: "/admin/crm/dedupe", label: "Dedupe & merge clienti" },
    ],
  },
  {
    id: "vendite",
    label: "Vendite",
    items: [
      { href: "/admin/crm/opportunities", label: "Opportunità" },
      { href: "/admin/audit/digital", label: "Audit digitale" },
      { href: "/admin/reach", label: "Outreach (Reach)" },
      { href: "/admin/reach/sequences", label: "Sequenze" },
      { href: "/admin/sales/brands", label: "Brand" },
      { href: "/admin/inserimenti", label: "Inserimenti (compensi negozio)" },
    ],
  },
  {
    id: "finanza",
    label: "Finanza",
    items: [
      { href: "/admin/finance", label: "Finance (voci)" },
      { href: "/admin/economics", label: "MRR / Economics" },
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
      // Hub Social: Contenuti apre le schede Contenuti/Calendario/Engagement/Inbox.
      { href: "/admin/posts", label: "Social / Contenuti" },
      { href: "/admin/automation-rules", label: "Automazioni (regole)" },
      { href: "/admin/automations", label: "Automazioni (cron & integrazioni)" },
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
      // Hub Analitiche: Insights apre la dashboard a schede (Forecast, Revenue at risk,
      // Commerciale, Salute portafoglio, NBA, Economics, Regia operativa).
      { href: "/admin/insights", label: "Insights (hub analitiche)" },
      { href: "/admin/crm/dormant", label: "Dormienti" },
      { href: "/admin/memory", label: "Memoria" },
      { href: "/admin/chat", label: "Chat assistente" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { href: "/admin/settings", label: "Impostazioni" },
      { href: "/admin/users", label: "Utenti" },
      { href: "/admin/search", label: "Ricerca globale" },
      { href: "/admin/activity", label: "Attività" },
      { href: "/admin/audit", label: "Audit log" },
      { href: "/admin/notifications", label: "Notifiche" },
    ],
  },
];
