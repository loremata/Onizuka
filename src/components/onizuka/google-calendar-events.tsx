import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isGoogleCalendarConnected, listGoogleCalendarEvents } from "@/lib/google-calendar-oauth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function GoogleCalendarEventsCard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;

  const connected = await isGoogleCalendarConnected(session.user.id);
  if (!connected) return null;

  const events = await listGoogleCalendarEvents(session.user.id, 7);
  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Google Calendar</CardTitle>
          <CardDescription>Nessun evento nei prossimi 7 giorni.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const fmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Google Calendar</CardTitle>
        <CardDescription>Prossimi eventi (sola lettura).</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="border-b border-border/40 pb-2 last:border-0">
              {e.htmlLink ? (
                <Link href={e.htmlLink} className="font-medium text-primary hover:underline" target="_blank">
                  {e.summary}
                </Link>
              ) : (
                <span className="font-medium">{e.summary}</span>
              )}
              <p className="text-xs text-muted-foreground">
                {e.start ? fmt.format(new Date(e.start)) : "—"}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
