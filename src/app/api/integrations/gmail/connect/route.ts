import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildGmailAuthUrl, isGmailOAuthConfigured } from "@/lib/gmail-oauth";
import { signOAuthState } from "@/lib/oauth-state";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json({ error: "Gmail OAuth non configurato" }, { status: 503 });
  }

  const state = signOAuthState(session.user.id, "GMAIL");
  const url = buildGmailAuthUrl(state);
  if (!url) return NextResponse.json({ error: "URL OAuth non disponibile" }, { status: 503 });

  return NextResponse.redirect(url);
}
