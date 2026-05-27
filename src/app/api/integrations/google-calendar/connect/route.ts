import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildGoogleCalendarAuthUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar-oauth";
import { signOAuthState } from "@/lib/oauth-state";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json({ error: "Google Calendar non configurato in .env" }, { status: 503 });
  }

  const state = signOAuthState(session.user.id, "GOOGLE_CALENDAR");
  const url = buildGoogleCalendarAuthUrl(state);
  if (!url) {
    return NextResponse.json({ error: "Impossibile costruire URL OAuth" }, { status: 503 });
  }

  return NextResponse.redirect(url);
}
