import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";
import { buildMailtoUrl, resolveGmailSendMode } from "@/lib/mailto-outreach";
import { sendGmailViaApi } from "@/lib/gmail-api";
import { isGmailConnected } from "@/lib/gmail-oauth";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { markOutreachDraftSent } from "@/lib/outreach-sent";
import { wrapOutreachHtmlBody } from "@/lib/outreach-tracking";
import { pickOutreachBody, pickOutreachSubject } from "@/lib/outreach-ab";
import { resolveReachAbVariantForSend } from "@/lib/reach-ab-default";

/** Invio outreach: SMTP se configurato, altrimenti mailto. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const draftId = typeof body.draftId === "string" ? body.draftId : "";
  const markSent = body.markSent === true;
  const abVariant = await resolveReachAbVariantForSend(
    session.user.id,
    typeof body.abVariant === "string" ? body.abVariant : undefined
  );

  if (!draftId) {
    return NextResponse.json({ error: "draftId richiesto" }, { status: 400 });
  }

  const draft = await prisma.outreachDraft.findFirst({
    where: { id: draftId, ownerUserId: session.user.id },
    include: { client: { select: { contactEmail: true, companyName: true } } },
  });

  if (!draft) {
    return NextResponse.json({ error: "Bozza non trovata" }, { status: 404 });
  }

  if (draft.status !== "APPROVED" && draft.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "Bozza non approvata per l'invio" }, { status: 400 });
  }

  const subject = pickOutreachSubject(draft, abVariant);
  const emailBody = pickOutreachBody(draft, abVariant);
  const to = draft.client?.contactEmail?.trim() ?? "";
  const mode = resolveGmailSendMode();

  if (to && (await isGmailConnected(session.user.id))) {
    const viaApi = await sendGmailViaApi(session.user.id, {
      to,
      subject,
      text: emailBody,
      html: wrapOutreachHtmlBody(emailBody, draft.id),
    });
    if (viaApi.ok) {
      if (markSent) {
        await markOutreachDraftSent(draftId, session.user.id, { abVariantSent: abVariant });
      }
      return NextResponse.json({
        mode: "gmail_api",
        sent: true,
        markedSent: markSent,
        to,
        abVariant,
        subject,
      });
    }
  }

  if (mode === "smtp" && to) {
    const sent = await sendEmailViaSmtp({
      to,
      subject,
      text: emailBody,
      html: wrapOutreachHtmlBody(emailBody, draft.id),
    });
    if (!sent.ok) {
      return NextResponse.json({ error: sent.error }, { status: 502 });
    }
    if (markSent) {
      await markOutreachDraftSent(draftId, session.user.id, { abVariantSent: abVariant });
    }
    return NextResponse.json({
      mode: "smtp",
      sent: true,
      markedSent: markSent,
      to,
      abVariant,
      subject,
    });
  }

  if (mode === "smtp" && !to) {
    return NextResponse.json({ error: "Email destinatario mancante sul cliente" }, { status: 400 });
  }

  const mailto = buildMailtoUrl({ to: to || undefined, subject, body: emailBody });
  return NextResponse.json({
    mode: "mailto",
    mailto,
    smtpAvailable: isSmtpConfigured(),
    abVariant,
    subject,
    message: "Apri il client email precompilato. Dopo l'invio, segna come inviata in Reach.",
  });
}
