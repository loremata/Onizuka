import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Disiscrizione marketing (GDPR) — endpoint PUBBLICO, senza auth.
 * `/api/public/*` è fuori dal matcher di `src/middleware.ts`, quindi nessuna sessione richiesta.
 *
 * GET con token opaco del Client (`Client.marketingOptOutToken`):
 *  - se il token esiste, setta `marketingOptOutAt=now` (idempotente: non lo sovrascrive se già presente)
 *    e mette in SUPPRESSED tutte le CampaignEnrollment ACTIVE (exitReason="disiscrizione");
 *  - risponde SEMPRE con una pagina HTML cortese e neutra, senza rivelare dati né distinguere
 *    il caso "token inesistente" da "token valido" (privacy: nessuna enumerazione).
 */

function htmlPage(message: string): NextResponse {
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
  @media (prefers-color-scheme: dark) {
    body { background: #111114; color: #f2f2f4; }
    .card { background: #1c1c20; box-shadow: none; }
    p { color: #b8b8bf; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="mark" aria-hidden="true">✅</div>
    <h1>Preferenze aggiornate</h1>
    <p>${message}</p>
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

const DONE_MESSAGE =
  "Sei stato disiscritto dalle comunicazioni marketing. Non riceverai più email di questo tipo.";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = (token ?? "").trim();

  // Token assente/malformato: messaggio neutro identico (nessuna enumerazione).
  if (!clean) {
    return htmlPage(DONE_MESSAGE);
  }

  try {
    const client = await prisma.client.findUnique({
      where: { marketingOptOutToken: clean },
      select: { id: true, marketingOptOutAt: true },
    });

    // Token inesistente: stesso messaggio neutro, non riveliamo nulla.
    if (!client) {
      return htmlPage(DONE_MESSAGE);
    }

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
  } catch (e) {
    // Fail-safe: anche in caso di errore mostriamo un messaggio cortese, senza dettagli tecnici.
    console.error("[public.unsubscribe]", e);
  }

  return htmlPage(DONE_MESSAGE);
}
