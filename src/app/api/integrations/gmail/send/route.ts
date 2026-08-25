import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/smtp-send";
import { sendOutreachDraftNow } from "@/lib/outreach-send";

/**
 * Invio outreach dalla UI (Reach / Approvazioni).
 *
 * Questa route NON spedisce più per conto proprio: delega interamente a
 * `sendOutreachDraftNow`, che è l'unico punto da cui esce una mail di outreach.
 * Prima esisteva una seconda strada che saltava consenso, disiscrizione,
 * cooldown anti-doppione e header List-Unsubscribe — cioè proprio le garanzie
 * che il percorso "ufficiale" applicava. Un solo choke point, un solo insieme
 * di regole.
 *
 * `markSent: true`  → spedisci adesso col canale configurato.
 * `markSent: false` → non spedire: restituisci il testo già decorato per
 *                     l'invio manuale dal client di posta.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const draftId = typeof body.draftId === "string" ? body.draftId : "";
  const inviaOra = body.markSent === true;

  if (!draftId) {
    return NextResponse.json({ error: "draftId richiesto" }, { status: 400 });
  }

  // La proprietà della bozza resta un controllo di questa route: la funzione di
  // invio lavora per id e non conosce la sessione.
  const draft = await prisma.outreachDraft.findFirst({
    where: { id: draftId, ownerUserId: session.user.id },
    select: { id: true, status: true },
  });
  if (!draft) {
    return NextResponse.json({ error: "Bozza non trovata" }, { status: 404 });
  }
  if (draft.status !== "APPROVED" && draft.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "Bozza non approvata per l'invio" }, { status: 400 });
  }

  // Premere "Invia" su una bozza in attesa È l'approvazione umana: registriamola
  // invece di scavalcarla in silenzio, così lo storico resta leggibile.
  if (inviaOra && draft.status === "PENDING_APPROVAL") {
    await prisma.outreachDraft.updateMany({
      where: { id: draftId, ownerUserId: session.user.id, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED" },
    });
  }

  const result = await sendOutreachDraftNow(draftId, inviaOra ? undefined : { prepareOnly: true });

  if (result.sent) {
    return NextResponse.json({
      mode: result.channel ?? "smtp",
      sent: true,
      markedSent: true,
      to: result.to,
      note: result.note,
    });
  }

  // Non spedita ma il testo è pronto: apertura nel client di posta.
  if (result.mailto) {
    return NextResponse.json({
      mode: "mailto",
      sent: false,
      mailto: result.mailto,
      to: result.to,
      subject: result.prepared?.subject,
      smtpAvailable: isSmtpConfigured(),
      message: "Apri il client email precompilato. Dopo l'invio, segna come inviata in Reach.",
    });
  }

  // Bloccata da una guardia (consenso, disiscrizione, doppione, qualità del testo).
  return NextResponse.json({ error: result.note }, { status: 400 });
}
