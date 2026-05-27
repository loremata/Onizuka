import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { isWhatsAppConfigured } from "@/lib/whatsapp-cloud";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsAppOperatorInbox } from "@/components/onizuka/whatsapp-operator-inbox";
import { isWhatsAppTemplateSyncConfigured } from "@/lib/whatsapp-sync-templates";
import {
  deleteWhatsAppTemplateForm,
  syncWhatsAppTemplatesAction,
  upsertWhatsAppPhoneLine,
  upsertWhatsAppTemplate,
} from "./actions";

type Props = { searchParams: Promise<{ line?: string }> };

export default async function WhatsAppOperatorPage({ searchParams }: Props) {
  await requireAdminArea();
  const { line: lineFilter } = await searchParams;

  const [messages, staffUsers, templates, phoneLines] = await Promise.all([
    prisma.whatsAppInboundMessage.findMany({
      where: lineFilter ? { phoneLineId: lineFilter } : undefined,
      orderBy: { receivedAt: "desc" },
      take: 40,
      include: {
        assignee: { select: { name: true, email: true } },
        phoneLine: { select: { label: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: { email: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.whatsAppTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.whatsAppPhoneLine.findMany({ orderBy: [{ isDefault: "desc" }, { label: "asc" }] }),
  ]);

  const rows = messages.map((m) => ({
    id: m.id,
    phoneFrom: m.phoneFrom,
    body: m.body,
    receivedAt: m.receivedAt.toISOString(),
    repliedAt: m.repliedAt?.toISOString() ?? null,
    assignedUserId: m.assignedUserId,
    assigneeName: m.assignee?.name ?? m.assignee?.email ?? null,
    phoneLineLabel: m.phoneLine?.label ?? m.phoneNumberId ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/settings">← Impostazioni</Link>
        </Button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">WhatsApp operatore</h1>
        <p className="text-muted-foreground">
          Inbox two-way per linea (routing webhook <code className="text-xs">phone_number_id</code>).
          {!isWhatsAppConfigured() ? " API non configurata." : null}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/whatsapp"
            className={!lineFilter ? "font-medium text-primary" : "text-muted-foreground hover:underline"}
          >
            Tutte le linee
          </Link>
          {phoneLines.map((l) => (
            <Link
              key={l.id}
              href={`/admin/whatsapp?line=${l.id}`}
              className={lineFilter === l.id ? "font-medium text-primary" : "text-muted-foreground hover:underline"}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linee WhatsApp (multi-numero)</CardTitle>
          <CardDescription>Phone number ID Meta per routing inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <form action={upsertWhatsAppPhoneLine} className="grid gap-2 sm:grid-cols-3">
            <Input name="label" placeholder="Etichetta" required />
            <Input name="phoneNumberId" placeholder="Phone number ID" required className="font-mono text-xs" />
            <Input name="wabaId" placeholder="WABA ID (opz.)" className="font-mono text-xs" />
            <label className="flex items-center gap-2 text-xs sm:col-span-3">
              <input type="checkbox" name="isDefault" /> Linea predefinita
            </label>
            <Button type="submit" size="sm">
              Salva linea
            </Button>
          </form>
          {phoneLines.length > 0 ? (
            <ul className="divide-y">
              {phoneLines.map((l) => (
                <li key={l.id} className="py-2 font-mono text-xs">
                  {l.label} · {l.phoneNumberId}
                  {l.isDefault ? " · default" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nessuna linea registrata (fallback env WHATSAPP_PHONE_NUMBER_ID).</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inbox</CardTitle>
            <CardDescription>Ultimi messaggi webhook Meta.</CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppOperatorInbox
              messages={rows}
              staffUsers={staffUsers}
              templates={templates.map((t) => ({
                id: t.id,
                name: t.name,
                bodyPreview: t.bodyPreview,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catalogo template</CardTitle>
            <CardDescription>Nomi template approvati su Meta Business Manager.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isWhatsAppTemplateSyncConfigured() ? (
              <form action={syncWhatsAppTemplatesAction}>
                <Button type="submit" size="sm" variant="outline">
                  Sync da Meta API
                </Button>
              </form>
            ) : null}
            <form action={upsertWhatsAppTemplate} className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="name">Nome template</Label>
                <Input id="name" name="name" required placeholder="es. follow_up_it" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bodyPreview">Anteprima testo</Label>
                <Input id="bodyPreview" name="bodyPreview" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="category">Categoria</Label>
                <Input id="category" name="category" placeholder="UTILITY" />
              </div>
              <Button type="submit" size="sm">
                Salva template
              </Button>
            </form>
            {templates.length > 0 ? (
              <ul className="divide-y text-sm">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <strong>{t.name}</strong> ({t.languageCode}) — {t.bodyPreview.slice(0, 60)}
                    </span>
                    <form action={deleteWhatsAppTemplateForm}>
                      <input type="hidden" name="id" value={t.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        Elimina
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nessun template in catalogo.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
