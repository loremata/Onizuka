import Link from "next/link";
import { getDeployCapabilities } from "@/lib/deploy-capabilities";
import { isStripeConfigured } from "@/lib/stripe-client";
import { isTelegramConfigured } from "@/lib/telegram-bot";
import { isLlmConfigured } from "@/lib/llm-client";

export const dynamic = "force-dynamic";

async function fetchHealth(path: string, base: string) {
  try {
    const res = await fetch(`${base}${path}`, { cache: "no-store", next: { revalidate: 0 } });
    const json = (await res.json()) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: {} };
  }
}

export default async function PublicStatusPage() {
  const caps = getDeployCapabilities();
  const appUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";
  const base = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

  const [health, ready] = await Promise.all([
    fetchHealth("/api/health", base),
    fetchHealth("/api/health/ready", base),
  ]);

  const dbOk = ready.json.database === "ok";
  const liveOk = health.ok && ready.ok && dbOk;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="onizuka-page-title">Stato Onizuka</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitoraggio pubblico sintetico.</p>
      </div>
      <p className="text-sm">
        Servizio:{" "}
        <span className={liveOk ? "font-medium text-green-600" : "font-medium text-amber-600"}>
          {liveOk ? "operativo" : "degradato / non verificato"}
        </span>
      </p>
      <ul className="space-y-2 text-sm">
        <li>
          App:{" "}
          <Link href={base} className="text-primary hover:underline">
            {base}
          </Link>
        </li>
        <li>
          API health: {health.ok ? "OK" : "errore"} (HTTP {health.status || "—"})
        </li>
        <li>
          Database: {dbOk ? "OK" : "non disponibile"} (HTTP {ready.status || "—"})
        </li>
        <li>Storage: {caps.storage}</li>
        <li>Cron protetto: {caps.cron ? "sì" : "no"}</li>
        <li>SMTP: {caps.smtp ? "configurato" : "non configurato"}</li>
        <li>Stripe: {isStripeConfigured() ? "configurato" : "non configurato"}</li>
        <li>Telegram: {isTelegramConfigured() ? "configurato" : "non configurato"}</li>
        <li>Assistente LLM: {isLlmConfigured() ? "configurato" : "non configurato"}</li>
      </ul>
      <p className="text-xs text-muted-foreground">
        Accesso operativo:{" "}
        <Link href="/login" className="text-primary hover:underline">
          login
        </Link>
        {" · "}
        <Link href="/admin/go-live" className="text-primary hover:underline">
          go-live (admin)
        </Link>
      </p>
    </main>
  );
}
