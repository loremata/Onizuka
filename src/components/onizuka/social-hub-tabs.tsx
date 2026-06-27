import { HubLinkTabs } from "@/components/onizuka/hub-link-tabs";

/** Hub Social: contenuti, calendario, engagement, inbox come un unico strumento. */
const TABS = [
  { href: "/admin/social", label: "Panoramica" },
  { href: "/admin/posts", label: "Contenuti" },
  { href: "/admin/social/calendar", label: "Calendario" },
  { href: "/admin/social/engagement", label: "Engagement" },
  { href: "/admin/social/inbox", label: "Inbox commenti" },
];

export function SocialHubTabs() {
  return <HubLinkTabs label="Social" tabs={TABS} />;
}
