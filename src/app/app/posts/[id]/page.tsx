import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PostActions } from "./post-actions";
import { platformLabelIt } from "@/lib/post-ui-labels";

export default async function ClientPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAppClientContext();
  const { id } = await params;
  const post = await prisma.postItem.findFirst({
    where: { id, clientId: ctx.clientId },
    include: {
      media: true,
      comments: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app">← Torna ai post</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{platformLabelIt[post.platform]}</CardTitle>
            <StatusBadge status={post.status} />
          </div>
          <CardDescription>
            Creato il {new Date(post.createdAt).toLocaleString()}
            {post.updatedAt.getTime() !== post.createdAt.getTime() &&
              ` · Aggiornato il ${new Date(post.updatedAt).toLocaleString()}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Didascalia</p>
            <p className="mt-1 whitespace-pre-wrap">{post.captionText || "—"}</p>
          </div>

          {post.scheduledFor && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Programmato per</p>
              <p className="mt-1">{new Date(post.scheduledFor).toLocaleString()}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-muted-foreground">Media ({post.media.length})</p>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {post.media.map((m) => (
                <div key={m.id} className="flex flex-col gap-1">
                  {m.type === "IMAGE" ? (
                    <div className="aspect-square overflow-hidden rounded-md border bg-muted">
                      <img
                        src={m.url}
                        alt={m.filename}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
                      Video
                    </div>
                  )}
                  <span className="truncate text-xs text-muted-foreground">{m.filename}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Attività e commenti</p>
            <ul className="mt-2 space-y-3">
              <li className="text-sm text-muted-foreground">
                Post creato il {new Date(post.createdAt).toLocaleString()}
              </li>
              {post.comments.map((c) => (
                <li key={c.id} className="rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-medium">
                    {c.user.name || c.user.email}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
          </div>

          {post.status === "PENDING" && (
            <PostActions postId={post.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
