import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { SocialHubTabs } from "@/components/onizuka/social-hub-tabs";
import { prisma } from "@/lib/prisma";
import { platformLabelIt } from "@/lib/post-ui-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialInboxCommentForm } from "./social-inbox-comment-form";
import { SocialInboxReplyButton } from "./social-inbox-reply-button";
import { SocialInboxReplyForm } from "./social-inbox-reply-form";
import { SocialSyncToolbar } from "./social-sync-toolbar";
import { isMetaCommentsSyncConfigured } from "@/lib/meta-comments-sync";
import { isLinkedInCommentsSyncConfigured } from "@/lib/social-linkedin-sync";
import { isInstagramCommentsSyncConfigured } from "@/lib/social-instagram-sync";

export default async function SocialInboxPage() {
  await requireAdminArea();

  const [comments, clients] = await Promise.all([
    prisma.socialInboxComment.findMany({
      orderBy: { receivedAt: "desc" },
      take: 50,
      include: { client: { select: { companyName: true } } },
    }),
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
      take: 200,
    }),
  ]);

  const fmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <SocialHubTabs />
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/social">← Social Pro</Link>
        </Button>
        <h1 className="mt-2 onizuka-page-title">Inbox commenti</h1>
        <p className="text-muted-foreground">
          Registro manuale + sync Meta / LinkedIn / Instagram. Segna come risposto dopo la gestione.
        </p>
        <SocialSyncToolbar
          meta={isMetaCommentsSyncConfigured()}
          linkedin={isLinkedInCommentsSyncConfigured()}
          instagram={isInstagramCommentsSyncConfigured()}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registra commento</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialInboxCommentForm clients={clients} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coda</CardTitle>
          <CardDescription>{comments.filter((c) => !c.repliedAt).length} da rispondere</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {comments.length === 0 ? (
            <p className="text-muted-foreground">Nessun commento in coda.</p>
          ) : (
            <ul className="divide-y">
              {comments.map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">
                      {platformLabelIt[c.platform]}
                      {c.client ? ` · ${c.client.companyName}` : ""}
                      {c.repliedAt ? (
                        <span className="ml-2 text-xs text-green-600">risposto</span>
                      ) : (
                        <span className="ml-2 text-xs text-amber-600">aperto</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.authorName ? `${c.authorName} · ` : ""}
                      {fmt.format(c.receivedAt)}
                    </p>
                    <p className="mt-1">{c.body}</p>
                    {c.externalUrl ? (
                      <a href={c.externalUrl} target="_blank" rel="noreferrer" className="text-xs text-primary">
                        Apri su social
                      </a>
                    ) : null}
                  </div>
                  {!c.repliedAt ? (
                    <div className="min-w-[200px] space-y-2">
                      <SocialInboxReplyForm commentId={c.id} />
                      <SocialInboxReplyButton id={c.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
