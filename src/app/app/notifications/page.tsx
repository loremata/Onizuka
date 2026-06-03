import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { digestEmailEnabled } from "@/lib/notification-digest";
import { loadUserNotificationsPage } from "@/lib/user-notifications";
import { NotificationsPagination } from "@/components/notifications/notifications-pagination";
import { SendDigestButton } from "@/components/notifications/send-digest-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationRowActions } from "./notification-row-actions";
import { MarkAllNotificationsButton } from "./mark-all-notifications-button";
import { NotifyDigestForm } from "@/components/notifications/notify-digest-form";
import { prisma } from "@/lib/prisma";
import { sendClientNotificationDigestAction, setClientNotifyDigestEmailPreference } from "./actions";

const PAGE_SIZE = 20;

export default async function ClientNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) redirect("/login");

  const page = Math.max(0, Number((await searchParams).page ?? "0") || 0);
  const [{ items, total }, userPrefs] = await Promise.all([
    loadUserNotificationsPage(session.user.id, page, PAGE_SIZE),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notifyDigestEmail: true },
    }),
  ]);
  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="onizuka-page-title">Notifiche</h1>
          <p className="text-muted-foreground">Aggiornamenti da post e ticket supporto.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SendDigestButton action={sendClientNotificationDigestAction} enabled={digestEmailEnabled()} />
          <MarkAllNotificationsButton />
        </div>
      </div>
      <Link href="/app" className="text-sm text-primary hover:underline">
        ← Torna ai contenuti
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email digest</CardTitle>
        </CardHeader>
        <CardContent>
          <NotifyDigestForm
            defaultEnabled={userPrefs?.notifyDigestEmail !== false}
            action={setClientNotifyDigestEmailPreference}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Centro notifiche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {items.length === 0 ? (
            <p className="text-muted-foreground">Nessuna notifica.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-md border p-3 ${n.readAt ? "border-border/40 opacity-80" : "border-primary/30 bg-primary/5"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{dateFmt.format(n.createdAt)}</p>
                    </div>
                    <NotificationRowActions notificationId={n.id} isRead={Boolean(n.readAt)} />
                  </div>
                  {n.body ? <p className="mt-1 text-muted-foreground">{n.body}</p> : null}
                  {n.href ? (
                    <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
                      <Link href={n.href}>Apri</Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <NotificationsPagination basePath="/app/notifications" page={page} total={total} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>
    </div>
  );
}
