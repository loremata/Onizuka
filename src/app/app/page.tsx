import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClientPostsFilters } from "./client-posts-filters";
import { platformLabelIt } from "@/lib/post-ui-labels";
import type { Platform, PostStatus } from "@prisma/client";

type SearchParams = { platform?: Platform; status?: PostStatus };

export default async function ClientAppPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requireAppClientContext();
  const params = await searchParams;
  const platform = params.platform;
  const status = params.status;

  const clientId = ctx.clientId;

  const [posts, pendingCount, approvedCount, revisionCount] = await Promise.all([
    prisma.postItem.findMany({
      where: {
        clientId,
        awaitingClientReview: true,
        ...(platform ? { platform } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { media: true, comments: true } },
        media: { take: 1 },
      },
    }),
    prisma.postItem.count({ where: { clientId, status: "PENDING", awaitingClientReview: true } }),
    prisma.postItem.count({ where: { clientId, status: "APPROVED" } }),
    prisma.postItem.count({ where: { clientId, status: "NEEDS_REVISION" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="onizuka-page-title">Contenuti da revisionare</h1>
          <p className="onizuka-page-lead">Approva o richiedi modifiche per i tuoi post.</p>
          <Link href="/app/upload" className="mt-2 inline-block text-sm text-primary hover:underline">
            Invia nuova creatività →
          </Link>
        </div>
        <Link href="/app/dashboard" className="text-sm text-primary hover:underline">
          Dashboard KPI →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In attesa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approvati</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Da rivedere</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{revisionCount}</p>
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Caricamento filtri…</p>}>
        <ClientPostsFilters currentPlatform={platform ?? ""} currentStatus={status ?? ""} />
      </Suspense>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessun post corrisponde ai filtri. Vedi solo i contenuti del tuo spazio di lavoro.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/app/posts/${post.id}`} className="min-w-0">
              <Card className="h-full transition-colors hover:bg-muted/50 active:bg-muted">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{platformLabelIt[post.platform]}</CardTitle>
                    <StatusBadge status={post.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {post.media[0] && (
                    <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                      {post.media[0].type === "IMAGE" ? (
                        <img
                          src={post.media[0].url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          Video
                        </div>
                      )}
                    </div>
                  )}
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {post.captionText || "Nessuna didascalia"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {post._count.media} media · {post._count.comments} commenti
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
