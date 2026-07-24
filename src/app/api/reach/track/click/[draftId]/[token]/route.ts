import { NextResponse } from "next/server";
import { verifyOutreachDraftToken, recordOutreachClick } from "@/lib/outreach-tracking";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ draftId: string; token: string }> }
) {
  const { draftId, token } = await params;
  const target = new URL(request.url).searchParams.get("u");

  // Open-redirect guard: redirigiamo verso `u` SOLO se il token è valido.
  // Le email legittime portano sempre un token valido → nessun impatto reale.
  // Con token non valido non seguiamo `u` (evitiamo il redirect arbitrario).
  if (!verifyOutreachDraftToken(draftId, token)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await recordOutreachClick(draftId).catch(() => undefined);

  // Inoltre `u` deve essere http/https, altrimenti niente redirect.
  if (target && /^https?:\/\//i.test(target)) {
    return NextResponse.redirect(target, { status: 302 });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
