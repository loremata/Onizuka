import Link from "next/link";
import { Button } from "@/components/ui/button";

const checks = [
  { href: "/api/health", label: "Health liveness", external: true },
  { href: "/api/health/ready", label: "Health readiness (DB)", external: true },
  { href: "/admin/go-live", label: "Hub go-live" },
  { href: "/admin/settings", label: "Impostazioni e integrazioni" },
  { href: "/admin/webhooks", label: "Test webhook n8n" },
  { href: "/api/admin/n8n/status", label: "Stato API n8n (JSON)", external: true },
  { href: "/admin/notifications", label: "Centro notifiche" },
  { href: "/admin/audit", label: "Log audit" },
];

export function GoLiveLinks() {
  return (
    <ul className="space-y-2 text-sm">
      {checks.map((c) => (
        <li key={c.href}>
          {c.external ? (
            <a href={c.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {c.label}
            </a>
          ) : (
            <Link href={c.href} className="text-primary hover:underline">
              {c.label}
            </Link>
          )}
        </li>
      ))}
      <li className="pt-2 text-xs text-muted-foreground">
        Script: <span className="font-mono">npm run passi-mancanti:prod</span>,{" "}
        <span className="font-mono">npm run telegram:webhook</span>. Doc:{" "}
        <span className="font-mono">docs/README.md</span>.
      </li>
      <li className="pt-1 text-xs text-muted-foreground">
        Checklist: <span className="font-mono">PASSI-MANCANTI.md</span> · deploy:{" "}
        <span className="font-mono">docs/DEPLOY.md</span>.
      </li>
      <li className="pt-1">
        <Button asChild size="sm" variant="outline">
          <a
            href="https://vercel.com/docs/projects/domains"
            target="_blank"
            rel="noreferrer"
          >
            Docs domini Vercel
          </a>
        </Button>
      </li>
    </ul>
  );
}
