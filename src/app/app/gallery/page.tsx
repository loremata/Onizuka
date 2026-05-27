import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { platformLabelIt } from "@/lib/post-ui-labels";

export default async function ClientGalleryPage() {
  const ctx = await requireAppClientContext();
  const posts = await prisma.postItem.findMany({
    where: { clientId: ctx.clientId, status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    take: 48,
    include: { media: { take: 1 } },
  });

  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Galleria creatività</h1>
        <p className="text-muted-foreground">
          Contenuti approvati pronti per la pubblicazione ({posts.length}).
        </p>
        <Link href="/app" className="mt-2 inline-block text-sm text-primary hover:underline">
          ← Approvazioni
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun contenuto approvato ancora.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => (
            <Link key={post.id} href={`/app/posts/${post.id}`}>
              <Card className="h-full overflow-hidden transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{platformLabelIt[post.platform]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {post.media[0] ? (
                    <div className="aspect-square w-full overflow-hidden rounded-md bg-muted">
                      {post.media[0].type === "IMAGE" ? (
                        <img
                          src={post.media[0].url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          Video
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      Nessun media
                    </div>
                  )}
                  <p className="line-clamp-2 text-xs text-muted-foreground">{post.captionText || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Approvato {dateFmt.format(post.updatedAt)}
                    {post.scheduledFor ? ` · pubb. ${dateFmt.format(post.scheduledFor)}` : ""}
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
