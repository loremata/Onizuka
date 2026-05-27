import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPostListWhere, parsePostListFilters } from "@/lib/post-list-filters";
import { PostsTable } from "./posts-table";
import type { Platform, PostStatus } from "@prisma/client";

type SearchParams = { clientId?: string; platform?: Platform; status?: PostStatus; q?: string };

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parsePostListFilters(params as Record<string, string | string[] | undefined>);

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.postItem.findMany({
        where: buildPostListWhere(filters),
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { companyName: true, slug: true } },
          _count: { select: { media: true } },
        },
      }),
      prisma.client.findMany({ orderBy: { companyName: "asc" } }),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Post</h1>
          <p className="text-muted-foreground">Gestione contenuti e approvazioni.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [posts, clients] = loaded.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Post</h1>
          <p className="text-muted-foreground">
            Tutti i post; filtra per cliente, piattaforma, stato o testo (didascalia, riferimento esterno, cliente).
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/posts/new">Nuovo post</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tutti i post</CardTitle>
          <CardDescription>
            Usa i filtri qui sotto. Clicca una riga per aprire il dettaglio del post.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Caricamento filtri…</p>}>
            <PostsTable
              posts={posts}
              clients={clients}
              currentFilters={{
                clientId: filters.clientId,
                platform: filters.platform ?? "",
                status: filters.status ?? "",
                q: filters.q,
              }}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
