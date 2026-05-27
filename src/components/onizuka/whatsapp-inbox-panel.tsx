import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function WhatsAppInboxPanel() {
  const messages = await prisma.whatsAppInboundMessage.findMany({
    orderBy: { receivedAt: "desc" },
    take: 25,
  });

  const fmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" });

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Inbox WhatsApp</CardTitle>
        <CardDescription>
          Anteprima messaggi webhook. Inbox completa:{" "}
          <a href="/admin/whatsapp" className="text-primary hover:underline">
            /admin/whatsapp
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">Nessun messaggio ricevuto ancora.</p>
        ) : (
          <ul className="divide-y">
            {messages.map((m) => (
              <li key={m.id} className="py-2">
                <p className="font-medium">+{m.phoneFrom}</p>
                <p className="text-xs text-muted-foreground">{fmt.format(m.receivedAt)}</p>
                <p className="mt-1 line-clamp-3">{m.body ?? "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
