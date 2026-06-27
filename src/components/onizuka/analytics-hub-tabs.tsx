import { HubLinkTabs } from "@/components/onizuka/hub-link-tabs";

/** Hub Analitiche: dashboard analitiche come un unico strumento navigabile. */
const TABS = [
  { href: "/admin/insights", label: "Panoramica" },
  { href: "/admin/insights/forecast", label: "Forecast" },
  { href: "/admin/insights/revenue-at-risk", label: "Revenue at risk" },
  { href: "/admin/crm/commercial", label: "Commerciale" },
  { href: "/admin/crm/health-radar", label: "Salute portafoglio" },
  { href: "/admin/intelligence", label: "NBA / AI" },
  { href: "/admin/economics", label: "Economics" },
  { href: "/admin/regia-operativa", label: "Regia operativa" },
];

export function AnalyticsHubTabs() {
  return <HubLinkTabs label="Analitiche" tabs={TABS} />;
}
