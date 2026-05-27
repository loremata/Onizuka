import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isGmailConnected, isGmailOAuthConfigured } from "@/lib/gmail-oauth";
import { isSmtpConfigured } from "@/lib/smtp-send";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const configured = isGmailOAuthConfigured();
  const connected = configured ? await isGmailConnected(session.user.id) : false;

  return NextResponse.json({
    configured,
    connected,
    connectUrl: configured ? "/api/integrations/gmail/connect" : null,
    smtpFallback: isSmtpConfigured(),
    mvpFallback: "/admin/reach",
  });
}
