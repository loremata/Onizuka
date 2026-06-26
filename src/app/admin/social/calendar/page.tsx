import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { SocialHubTabs } from "@/components/onizuka/social-hub-tabs";
import { loadEditorialCalendar } from "@/lib/social-editorial-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SocialCalendarPage() {
  await requireAdminArea();
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const to = new Date(now);
  to.setDate(to.getDate() + 42);

  const items = await loadEditorialCalendar({ from, to });

  const fmt = dateTimeFormatIt({ dateStyle: "medium", timeStyle: "short" });
  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    const d = item.scheduledFor ?? item.createdAt;
    const key = d.toISOString().slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  const days = Array.from(byDay.keys()).sort();

  return (
    <div className="space-y-6">
      <SocialHubTabs />
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/social">← Social Pro</Link>
        </Button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Calendario editoriale</h1>
        <p className="text-muted-foreground">
          Post pianificati o creati negli ultimi 7 giorni e prossime 6 settimane ({items.length} voci).
        </p>
      </div>

      {days.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nessun contenuto nel periodo. Crea post da Contenuti o programma <code>scheduledFor</code>.
          </CardContent>
        </Card>
      ) : (
        days.map((day) => (
          <Card key={day}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{day}</CardTitle>
              <CardDescription>{byDay.get(day)!.length} contenut{(byDay.get(day)!.length === 1 ? "o" : "i")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {byDay.get(day)!.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium">
                        {item.clientName} · {item.platformLabel}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.captionText || "—"} · {item.status}
                        {item.scheduledFor ? ` · ${fmt.format(item.scheduledFor)}` : ""}
                      </p>
                    </div>
                    <Link href={`/admin/posts/${item.id}`} className="text-xs text-primary hover:underline">
                      Apri
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
