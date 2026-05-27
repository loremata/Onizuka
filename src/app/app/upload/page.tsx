import Link from "next/link";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { platformLabelIt } from "@/lib/post-ui-labels";
import { ClientCreativeForm } from "./client-creative-form";

export default async function ClientUploadPage() {
  const ctx = await requireAppClientContext();

  const pendingUploads = await prisma.postItem.findMany({
    where: {
      clientId: ctx.clientId,
      awaitingClientReview: false,
      status: { in: ["PENDING", "NEEDS_REVISION"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, platform: true, captionText: true, status: true, createdAt: true },
  });

  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Invia creatività</h1>
        <p className="text-muted-foreground">
          Carica foto o video per i tuoi canali social. Onizuka li prepara e ti chiederà l&apos;approvazione finale.
        </p>
        {ctx.isAdminPreview ? (
          <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Anteprima admin: l&apos;upload viene registrato in audit, senza notifica al team.
          </p>
        ) : null}
        <Link href="/app" className="mt-2 inline-block text-sm text-primary hover:underline">
          ← Contenuti da approvare
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuovo invio</CardTitle>
          <CardDescription>Formati: JPG, PNG, WebP, MP4, WebM.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientCreativeForm />
        </CardContent>
      </Card>

      {pendingUploads.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>I tuoi invii in revisione</CardTitle>
            <CardDescription>In attesa del team Onizuka prima dell&apos;approvazione.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y divide-border/60">
              {pendingUploads.map((p) => (
                <li key={p.id} className="py-2">
                  <p className="font-medium">
                    {platformLabelIt[p.platform]}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{p.status}</span>
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {p.captionText || "—"} · {dateFmt.format(p.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
