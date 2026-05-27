import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFullAdmin } from "@/lib/auth-roles";
import {
  buildGbpBusinessAuthUrl,
  isGbpBusinessConnected,
  isGbpBusinessOAuthConfigured,
} from "@/lib/gbp-business-oauth";
import { signOAuthState } from "@/lib/oauth-state";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const configured = isGbpBusinessOAuthConfigured();
  const connected = configured ? await isGbpBusinessConnected(session.user.id) : false;
  const connectUrl =
    configured && !connected
      ? buildGbpBusinessAuthUrl(signOAuthState(session.user.id, "GOOGLE_GBP"))
      : null;

  return NextResponse.json({
    configured,
    connected,
    connectUrl,
  });
}
