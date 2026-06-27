import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { SocialHubTabs } from "@/components/onizuka/social-hub-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SocialManagerPage() {
  await requireAdminArea();

  return (
    <div className="space-y-6">
      <SocialHubTabs />
      <div>
        <h1 className="onizuka-page-title">Social Manager Pro</h1>
        <p className="text-muted-foreground">
          Pubblicazione post con metriche, calendario editoriale, inbox commenti e metriche lato cliente in{" "}
          <Link href="/app/social" className="text-primary hover:underline">
            portale Social Pro
          </Link>
          .
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Moduli collegati</CardTitle>
          <CardDescription>Flussi già operativi nel MVP Onizuka.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/posts">Contenuti · post</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/reach">Reach · outreach</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/automation-rules">Regole automazione</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/social/calendar">Calendario editoriale</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/social/engagement">Report engagement</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/social/inbox">Inbox commenti</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/settings">WhatsApp · Impostazioni</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Publishing + metriche</CardTitle>
          <CardDescription>
            Da dettaglio post in Contenuti: segna pubblicato, URL live e impression/reach/engagement visibili al cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="default" size="sm">
            <Link href="/admin/posts">Apri Contenuti → pubblica post</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
