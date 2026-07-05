import { HubLinkTabs } from "@/components/onizuka/hub-link-tabs";

/** Hub Rubrica CRM: clienti, contatti, persone e segmenti come un'unica anagrafica. */
const TABS = [
  { href: "/admin/clients", label: "Clienti" },
  { href: "/admin/crm/contacts", label: "Contatti" },
  { href: "/admin/crm/people", label: "Persone" },
  { href: "/admin/crm/database", label: "Segmenti & database" },
];

export function CrmDirectoryTabs() {
  return <HubLinkTabs label="Rubrica" tabs={TABS} />;
}
