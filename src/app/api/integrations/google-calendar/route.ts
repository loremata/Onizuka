import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isGoogleCalendarConfigured, isGoogleCalendarConnected } from "@/lib/google-calendar-oauth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const configured = isGoogleCalendarConfigured();
  const connected = configured ? await isGoogleCalendarConnected(session.user.id) : false;

  return NextResponse.json({
    configured,
    connected,
    connectUrl: configured ? "/api/integrations/google-calendar/connect" : null,
    mvpFallback: "/admin/calendar",
  });
}
