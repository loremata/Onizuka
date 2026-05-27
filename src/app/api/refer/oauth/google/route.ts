import { NextRequest, NextResponse } from "next/server";
import { buildReferrerGoogleAuthUrl, isReferrerGoogleOAuthConfigured } from "@/lib/referrer-google-oauth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim();
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Token portale mancante." }, { status: 400 });
  }
  if (!isReferrerGoogleOAuthConfigured()) {
    return NextResponse.json({ error: "Google SSO non configurato." }, { status: 503 });
  }
  const url = buildReferrerGoogleAuthUrl(token);
  if (!url) return NextResponse.json({ error: "URL OAuth non disponibile." }, { status: 503 });
  return NextResponse.redirect(url);
}
