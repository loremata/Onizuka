import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClientPostsFilters } from "./client-posts-filters";
import type { Platform, PostStatus } from "@prisma/client";

const PLATFORM_LABELS: Record<Platform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  GBP: "Google Business",
};

type SearchParams = { platform?: Platform; status?: PostStatus };

export default async function ClientAppPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) redirect("/login");

  const params = await searchParams;
  const platform = params.platform;
  const status = params.status;

  const posts = await prisma.postItem.findMany({
    where: {
      clientId: session.user.clientId,
      ...(platform ? { platform } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { media: true, comments: true } },
      media: { take: 1 },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content to review</h1>
        <p className="text-muted-foreground">Approve or request changes for your posts.</p>
      </div>

      <ClientPostsFilters currentPlatform={platform ?? ""} currentStatus={status ?? ""} />

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No posts match the filters. You only see content for your workspace.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/app/posts/${post.id}`} className="min-w-0">
              <Card className="h-full transition-colors hover:bg-muted/50 active:bg-muted">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{PLATFORM_LABELS[post.platform]}</CardTitle>
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
                    {post.captionText || "No caption"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {post._count.media} media · {post._count.comments} comments
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
