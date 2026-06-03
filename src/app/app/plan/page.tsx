import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { platformLabelIt } from "@/lib/post-ui-labels";

export default async function ClientEditorialPlanPage() {
  const ctx = await requireAppClientContext();

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 45);

  const posts = await prisma.postItem.findMany({
    where: {
      clientId: ctx.clientId,
      scheduledFor: { gte: now, lte: horizon },
      status: { in: ["PENDING", "APPROVED"] },
    },
    orderBy: { scheduledFor: "asc" },
    take: 60,
    include: { media: { take: 1 } },
  });

  const dateFmt = dateTimeFormatIt({
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Piano editoriale</h1>
        <p className="text-muted-foreground">
          Contenuti programmati nei prossimi 45 giorni (in attesa o approvati).
        </p>
        <Link href="/app" className="mt-2 inline-block text-sm text-primary hover:underline">
          ← Approvazioni contenuti
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendario contenuti</CardTitle>
          <CardDescription>
            {posts.length === 0
              ? "Nessun post con data di pubblicazione programmata."
              : `${posts.length} post in programma`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {posts.length === 0 ? (
            <p className="text-muted-foreground">
              Quando l&apos;agenzia programmerà i post vedrai qui le date previste.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {posts.map((post) => (
                <li key={post.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {platformLabelIt[post.platform]} ·{" "}
                      {post.scheduledFor ? dateFmt.format(post.scheduledFor) : "—"}
                    </p>
                    <p className="line-clamp-2 text-muted-foreground">{post.captionText || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={post.status} />
                    <Link className="text-primary hover:underline" href={`/app/posts/${post.id}`}>
                      Dettaglio
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
