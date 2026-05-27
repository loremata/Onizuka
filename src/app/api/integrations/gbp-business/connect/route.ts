import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/auth-roles";
import { buildGbpBusinessAuthUrl, isGbpBusinessOAuthConfigured } from "@/lib/gbp-business-oauth";
import { signOAuthState } from "@/lib/oauth-state";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!isGbpBusinessOAuthConfigured()) {
    return NextResponse.json(
      { error: "GBP OAuth non configurato (GOOGLE_GBP_CLIENT_ID o Calendar OAuth)." },
      { status: 503 }
    );
  }

  const state = signOAuthState(session.user.id, "GOOGLE_GBP");
  const authUrl = buildGbpBusinessAuthUrl(state);
  if (!authUrl) {
    return NextResponse.json({ error: "Impossibile costruire URL OAuth." }, { status: 503 });
  }

  return NextResponse.redirect(authUrl);
}
