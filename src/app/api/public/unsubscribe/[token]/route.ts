import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Disiscrizione marketing (GDPR) — endpoint PUBBLICO, senza auth.
 * `/api/public/*` è fuori dal matcher di `src/middleware.ts`, quindi nessuna sessione richiesta.
 *
 * Due verbi, per un motivo preciso:
 *  - **POST** esegue la disiscrizione. È il verbo previsto da RFC 8058 per il
 *    "one-click" dei client di posta (`List-Unsubscribe-Post`).
 *  - **GET** mostra solo una pagina di conferma con un bottone che fa POST.
 *    Non scrive nulla: gli scanner antispam e Outlook Safe Links pre-caricano i
 *    link delle email, e con un GET scrivente disiscrivevano le persone da sole.
 *
 * In entrambi i casi la risposta è neutra e identica per token validi e non
 * validi: nessuna enumerazione, nessun dato rivelato.
 */

function page(opts: {
  mark: string;
  title: string;
  message: string;
  action?: { url: string; label: string };
}): NextResponse {
  const body = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Disiscrizione — Online Station</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #f5f5f7; color: #1d1d1f; display: flex; min-height: 100vh;
    align-items: center; justify-content: center; padding: 24px; }
  .card { background: #fff; border-radius: 16px; padding: 32px 28px; max-width: 460px;
    width: 100%; box-shadow: 0 8px 30px rgba(0,0,0,.08); text-align: center; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { font-size: 15px; line-height: 1.5; color: #4a4a4f; margin: 0; }
  .mark { font-size: 40px; margin-bottom: 8px; }
  button { margin-top: 20px; font: inherit; font-weight: 600; cursor: pointer;
    background: #1d1d1f; color: #fff; border: 0; border-radius: 10px; padding: 12px 22px; }
  button:hover { opacity: .9; }
  @media (prefers-color-scheme: dark) {
    body { background: #111114; color: #f2f2f4; }
    .card { background: #1c1c20; box-shadow: none; }
    p { color: #b8b8bf; }
    button { background: #f2f2f4; color: #111114; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="mark" aria-hidden="true">${opts.mark}</div>
    <h1>${opts.title}</h1>
    <p>${opts.message}</p>
    ${
      opts.action
        ? `<form method="post" action="${opts.action.url}"><button type="submit">${opts.action.label}</button></form>`
        : ""
    }
  </div>
</body>
</html>`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const DONE = {
  mark: "✅",
  title: "Preferenze aggiornate",
  message:
    "Sei stato disiscritto dalle comunicazioni marketing. Non riceverai più email di questo tipo.",
};

/** GET: nessuna scrittura, solo la conferma esplicita. */
export async function GET(req: Request) {
  return page({
    mark: "✉️",
    title: "Confermi la disiscrizione?",
    message:
      "Premendo il bottone non riceverai più nostre comunicazioni commerciali. Puoi chiudere questa pagina se hai aperto il link per sbaglio.",
    // Stessa URL, verbo POST: il token resta nel percorso.
    action: { url: new URL(req.url).pathname, label: "Disiscrivimi" },
  });
}

/** POST: esegue la disiscrizione (anche in one-click da client di posta). */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = (token ?? "").trim();

  if (!clean) return page(DONE);

  try {
    const client = await prisma.client.findUnique({
      where: { marketingOptOutToken: clean },
      select: { id: true, marketingOptOutAt: true },
    });

    // Token inesistente: stesso messaggio neutro, non riveliamo nulla.
    if (!client) return page(DONE);

    // Idempotente: registra l'opt-out solo la prima volta.
    if (!client.marketingOptOutAt) {
      await prisma.client.update({
        where: { id: client.id },
        data: { marketingOptOutAt: new Date() },
      });
    }

    // Ferma le campagne attive del cliente (idempotente: solo quelle ACTIVE).
    await prisma.campaignEnrollment.updateMany({
      where: { clientId: client.id, status: "ACTIVE" },
      data: {
        status: "SUPPRESSED",
        exitedAt: new Date(),
        exitReason: "disiscrizione",
      },
    });

    // Ferma anche le sequenze outreach in corso: la disiscrizione vale per tutta
    // la posta commerciale, non solo per le campagne.
    const { stopActiveOutreachSequences } = await import("@/lib/outreach-sequence-stop");
    await stopActiveOutreachSequences({ clientId: client.id, reason: "opt_out" }).catch(() => {});

    // Opt-out registrato ⇒ riconcilia le iscrizioni (best-effort): sopprime subito le residue.
    const { onClientCommercialStateChanged } = await import("@/lib/campaigns/client-commercial-events");
    void onClientCommercialStateChanged(client.id, { reason: "opt_out" }).catch(() => {});
  } catch (e) {
    // Fail-safe: anche in caso di errore mostriamo un messaggio cortese, senza dettagli tecnici.
    console.error("[public.unsubscribe]", e);
  }

  return page(DONE);
}
