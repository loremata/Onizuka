import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { digestEmailEnabled } from "@/lib/notification-digest";
import { loadUserNotificationsPage } from "@/lib/user-notifications";
import { NotificationsPagination } from "@/components/notifications/notifications-pagination";
import { SendDigestButton } from "@/components/notifications/send-digest-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminNotificationRowActions } from "./admin-notification-row-actions";
import { MarkAllAdminNotificationsButton } from "./mark-all-admin-notifications-button";
import { sendAdminNotificationDigestAction } from "./actions";

const PAGE_SIZE = 20;

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireAdminArea();

  const page = Math.max(0, Number((await searchParams).page ?? "0") || 0);
  const { items, total } = await loadUserNotificationsPage(session.user.id, page, PAGE_SIZE);
  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="onizuka-page-title">Notifiche</h1>
          <p className="text-muted-foreground">Ticket clienti, richieste portale e avvisi operativi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SendDigestButton action={sendAdminNotificationDigestAction} enabled={digestEmailEnabled()} />
          <MarkAllAdminNotificationsButton />
        </div>
      </div>
      <Link href="/admin" className="text-sm text-primary hover:underline">
        ← Command Center
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Centro notifiche admin</CardTitle>
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
                      <p className="text-xs text-muted-foreground">
                        {dateFmt.format(n.createdAt)} · {n.kind}
                      </p>
                    </div>
                    <AdminNotificationRowActions notificationId={n.id} isRead={Boolean(n.readAt)} />
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
          <NotificationsPagination
            basePath="/admin/notifications"
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
          />
        </CardContent>
      </Card>
    </div>
  );
}
