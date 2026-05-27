import { NextResponse } from "next/server";
import { verifyOutreachDraftToken, recordOutreachClick } from "@/lib/outreach-tracking";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ draftId: string; token: string }> }
) {
  const { draftId, token } = await params;
  const target = new URL(request.url).searchParams.get("u");

  if (verifyOutreachDraftToken(draftId, token)) {
    await recordOutreachClick(draftId).catch(() => undefined);
  }

  if (target && /^https?:\/\//i.test(target)) {
    return NextResponse.redirect(target, { status: 302 });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
