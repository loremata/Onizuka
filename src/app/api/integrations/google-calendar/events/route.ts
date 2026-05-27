import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isGoogleCalendarConnected, listGoogleCalendarEvents } from "@/lib/google-calendar-oauth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const connected = await isGoogleCalendarConnected(session.user.id);
  if (!connected) {
    return NextResponse.json({ connected: false, events: [] });
  }

  const events = await listGoogleCalendarEvents(session.user.id, 7);
  return NextResponse.json({ connected: true, events: events ?? [] });
}
