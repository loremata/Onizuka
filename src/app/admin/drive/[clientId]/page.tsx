import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { loadDriveClientFolder } from "@/lib/drive-stats";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Button } from "@/components/ui/button";
import { GoogleDriveFilesCard } from "@/components/onizuka/google-drive-files";
import { DriveStructureButton } from "../drive-structure-button";
import { isGoogleDriveServiceAccountConfigured } from "@/lib/google-drive-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const postStatusLabel: Record<string, string> = {
  PENDING: "In attesa",
  APPROVED: "Approvato",
  NEEDS_REVISION: "Revisione",
};

export default async function DriveClientFolderPage({ params }: { params: Promise<{ clientId: string }> }) {
  const session = await requireAdminArea();

  const { clientId } = await params;
  const loaded = await loadDriveClientFolder(clientId, session.user.id);

  if (!loaded.ok) {
    if (loaded.reason === "not_found") notFound();
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Cartella cliente</h1>
        <DbUnavailableBanner />
      </div>
    );
  }

  const { client, posts, assets, memoryItems, tickets } = loaded.folder;
  const dateFmt = dateTimeFormatIt({ dateStyle: "short" });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/drive">← Drive</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {client.driveFolderUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={client.driveFolderUrl} target="_blank" rel="noreferrer">
                Apri Google Drive
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/clients/${client.id}/edit`}>Imposta cartella Drive</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/clients/${client.id}`}>Scheda cliente</Link>
          </Button>
          {isGoogleDriveServiceAccountConfigured() ? (
            <DriveStructureButton clientId={client.id} />
          ) : null}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{client.companyName}</h1>
        <p className="text-muted-foreground">
          Cartella virtuale · slug <span className="font-mono">{client.slug}</span> · {client.contactEmail}
        </p>
      </div>

      <GoogleDriveFilesCard driveFolderUrl={client.driveFolderUrl} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contenuti</CardTitle>
            <CardDescription>Ultimi post approvazione.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {posts.length === 0 ? (
              <p className="text-muted-foreground">Nessun post.</p>
            ) : (
              posts.map((p) => (
                <div key={p.id} className="rounded border border-border/50 p-2">
                  <Link className="text-primary hover:underline" href={`/admin/posts/${p.id}`}>
                    {p.captionText || "Post"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {postStatusLabel[p.status] ?? p.status} · {dateFmt.format(p.updatedAt)}
                  </p>
                </div>
              ))
            )}
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href={`/admin/posts?clientId=${client.id}`}>Tutti i post</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Asset digitali</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {assets.length === 0 ? (
              <p className="text-muted-foreground">Nessun asset.</p>
            ) : (
              assets.map((a) => (
                <div key={a.id} className="rounded border border-border/50 p-2">
                  <Link className="text-primary hover:underline" href={`/admin/clients/${client.id}/assets/${a.id}/edit`}>
                    {a.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {a.platform ?? "—"} · {dateFmt.format(a.updatedAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Memoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {memoryItems.length === 0 ? (
              <p className="text-muted-foreground">Nessuna voce.</p>
            ) : (
              memoryItems.map((m) => (
                <div key={m.id} className="rounded border border-border/50 p-2">
                  <Link className="text-primary hover:underline" href={`/admin/memory/${m.id}/edit`}>
                    {m.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {m.scope} · {dateFmt.format(m.updatedAt)}
                  </p>
                </div>
              ))
            )}
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href={`/admin/memory?clientId=${client.id}`}>Memoria filtrata</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ticket supporto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {tickets.length === 0 ? (
              <p className="text-muted-foreground">Nessun ticket.</p>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="rounded border border-border/50 p-2">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.status} · {dateFmt.format(t.updatedAt)}
                  </p>
                </div>
              ))
            )}
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href="/admin/client-portal/tickets">Gestione ticket</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
