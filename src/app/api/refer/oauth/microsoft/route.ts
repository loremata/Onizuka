import { NextRequest, NextResponse } from "next/server";
import { buildReferrerMicrosoftAuthUrl, isReferrerMicrosoftOAuthConfigured } from "@/lib/referrer-microsoft-oauth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim();
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Token portale mancante." }, { status: 400 });
  }
  if (!isReferrerMicrosoftOAuthConfigured()) {
    return NextResponse.json({ error: "Microsoft SSO non configurato." }, { status: 503 });
  }
  const url = buildReferrerMicrosoftAuthUrl(token);
  if (!url) return NextResponse.json({ error: "URL OAuth non disponibile." }, { status: 503 });
  return NextResponse.redirect(url);
}
