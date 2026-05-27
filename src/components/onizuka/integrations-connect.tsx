"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type OAuthRow = {
  configured: boolean;
  connected: boolean;
  connectUrl: string | null;
};

export function IntegrationsConnect() {
  const searchParams = useSearchParams();
  const [calendar, setCalendar] = useState<OAuthRow | null>(null);
  const [gmail, setGmail] = useState<OAuthRow | null>(null);
  const [gbp, setGbp] = useState<OAuthRow | null>(null);
  const [eventsCount, setEventsCount] = useState<number | null>(null);
  const [pending, setPending] = useState<"calendar" | "gmail" | "gbp" | null>(null);

  const load = useCallback(() => {
    fetch("/api/integrations/google-calendar")
      .then((r) => r.json())
      .then((d) => setCalendar(d as OAuthRow))
      .catch(() => setCalendar(null));

    fetch("/api/integrations/gmail")
      .then((r) => r.json())
      .then((d) => setGmail(d as OAuthRow))
      .catch(() => setGmail(null));

    fetch("/api/integrations/gbp-business")
      .then((r) => r.json())
      .then((d) =>
        setGbp({
          configured: Boolean((d as { configured?: boolean }).configured),
          connected: Boolean((d as { connected?: boolean }).connected),
          connectUrl: (d as { connectUrl?: string | null }).connectUrl ?? null,
        })
      )
      .catch(() => setGbp(null));

    fetch("/api/integrations/google-calendar/events")
      .then((r) => r.json())
      .then((d: { connected?: boolean; events?: unknown[] }) => {
        if (d.connected) setEventsCount(d.events?.length ?? 0);
        else setEventsCount(null);
      })
      .catch(() => setEventsCount(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function disconnect(kind: "calendar" | "gmail" | "gbp") {
    setPending(kind);
    try {
      const path =
        kind === "calendar"
          ? "/api/integrations/google-calendar/disconnect"
          : kind === "gmail"
            ? "/api/integrations/gmail/disconnect"
            : "/api/integrations/gbp-business/disconnect";
      await fetch(path, { method: "POST" });
      load();
    } finally {
      setPending(null);
    }
  }

  if (!calendar || !gmail || !gbp) {
    return <p className="text-sm text-muted-foreground">Caricamento collegamenti…</p>;
  }

  return (
    <div className="space-y-4 border-t border-border/60 pt-4">
      <OAuthBlock
        title="Google Calendar"
        flash={searchParams.get("calendar")}
        row={calendar}
        eventsCount={eventsCount}
        pending={pending === "calendar"}
        onDisconnect={() => void disconnect("calendar")}
        extraLink={{ href: "/admin/calendar", label: "Agenda Flow" }}
      />
      <OAuthBlock
        title="Gmail"
        flash={searchParams.get("gmail")}
        row={gmail}
        pending={pending === "gmail"}
        onDisconnect={() => void disconnect("gmail")}
        extraLink={{ href: "/admin/reach", label: "Reach" }}
        hint="Invio outreach via API se collegato; altrimenti SMTP/mailto."
      />
      <OAuthBlock
        title="Google Business Profile"
        flash={searchParams.get("gbp")}
        row={gbp}
        pending={pending === "gbp"}
        onDisconnect={() => void disconnect("gbp")}
        extraLink={{ href: "/admin/audit/digital", label: "Audit digitale" }}
        hint="Recensioni e risposte GBP (scheda cliente con asset GBP)."
      />
      <p className="text-xs text-muted-foreground">
        Telegram: TELEGRAM_BOT_TOKEN + webhook /api/integrations/telegram
      </p>
    </div>
  );
}

function OAuthBlock({
  title,
  flash,
  row,
  eventsCount,
  pending,
  onDisconnect,
  extraLink,
  hint,
}: {
  title: string;
  flash: string | null;
  row: OAuthRow;
  eventsCount?: number | null;
  pending: boolean;
  onDisconnect: () => void;
  extraLink?: { href: string; label: string };
  hint?: string;
}) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      {flash === "connected" && <p className="text-sm text-green-600">Collegato.</p>}
      {flash === "error" && <p className="text-sm text-destructive">Collegamento fallito.</p>}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {!row.configured ? (
        <p className="text-sm text-muted-foreground">Credenziali OAuth mancanti in .env.</p>
      ) : row.connected ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-green-600">Connesso</span>
          {eventsCount != null ? (
            <span className="text-sm text-muted-foreground">{eventsCount} eventi (7g)</span>
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onDisconnect}>
            Scollega
          </Button>
          {extraLink ? (
            <Button asChild size="sm" variant="ghost">
              <a href={extraLink.href}>{extraLink.label}</a>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-2">
          <Button asChild size="sm">
            <a href={row.connectUrl ?? "#"}>Collega {title}</a>
          </Button>
        </div>
      )}
    </div>
  );
}
