import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPostActions } from "./admin-post-actions";
import { platformLabelIt, postStatusLabelIt } from "@/lib/post-ui-labels";
import { nativePublishAvailableForPlatform } from "@/lib/social-publish-native";

export default async function AdminPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await prisma.postItem.findUnique({
    where: { id },
    include: {
      client: true,
      media: true,
      comments: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/posts">← Post</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dettaglio post</CardTitle>
          <CardDescription>
            {post.client.companyName} · {platformLabelIt[post.platform]} · {postStatusLabelIt[post.status]}
            {!post.awaitingClientReview ? " · Invio cliente (revisione admin)" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Didascalia</p>
            <p className="whitespace-pre-wrap">{post.captionText || "—"}</p>
          </div>
          {post.scheduledFor && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Programmato per</p>
              <p>{new Date(post.scheduledFor).toLocaleString()}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Media ({post.media.length})</p>
            <div className="mt-2 flex flex-wrap gap-4">
              {post.media.map((m) => (
                <div key={m.id} className="flex flex-col gap-1">
                  {m.type === "IMAGE" ? (
                    <div className="relative h-32 w-32 overflow-hidden rounded-md border bg-muted">
                      <img
                        src={m.url}
                        alt={m.filename}
                        className="h-full w-full object-cover"
                        width={128}
                        height={128}
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                      Video
                    </div>
                  )}
                  <span className="max-w-[128px] truncate text-xs text-muted-foreground">
                    {m.filename}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {post.comments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Commenti ({post.comments.length})
              </p>
              <ul className="mt-2 space-y-2">
                {post.comments.map((c) => (
                  <li key={c.id} className="rounded-md border bg-muted/30 p-2 text-sm">
                    <span className="font-medium">{c.user.name || c.user.email}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <AdminPostActions
            postId={post.id}
            awaitingClientReview={post.awaitingClientReview}
            publishedAt={post.publishedAt}
            platform={post.platform}
            nativePublishAvailable={nativePublishAvailableForPlatform(post.platform)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
