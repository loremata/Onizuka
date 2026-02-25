import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PostsTable } from "./posts-table";
import type { Platform, PostStatus } from "@prisma/client";

type SearchParams = { clientId?: string; platform?: Platform; status?: PostStatus };

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const clientId = params.clientId?.trim();
  const platform = params.platform;
  const status = params.status;

  const [posts, clients] = await Promise.all([
    prisma.postItem.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(platform ? { platform } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { companyName: true, slug: true } },
        _count: { select: { media: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { companyName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-muted-foreground">All posts; filter by client, platform, or status.</p>
        </div>
        <Button asChild>
          <Link href="/admin/posts/new">New post</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All posts</CardTitle>
          <CardDescription>
            Use filters below. Click a row to view post details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PostsTable
            posts={posts}
            clients={clients}
            currentFilters={{ clientId: clientId ?? "", platform: platform ?? "", status: status ?? "" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
