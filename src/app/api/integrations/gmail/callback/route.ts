import { NextRequest, NextResponse } from "next/server";
import { exchangeGmailCode, saveGmailTokens } from "@/lib/gmail-oauth";
import { verifyOAuthState } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const settings = `${process.env.NEXTAUTH_URL?.replace(/\/$/, "")}/admin/settings`;

  if (url.searchParams.get("error") || !code || !state) {
    return NextResponse.redirect(`${settings}?gmail=error`);
  }

  const parsed = verifyOAuthState(state);
  if (!parsed || parsed.provider !== "GMAIL") {
    return NextResponse.redirect(`${settings}?gmail=invalid_state`);
  }

  try {
    const tokens = await exchangeGmailCode(code);
    await saveGmailTokens(parsed.userId, tokens);
    return NextResponse.redirect(`${settings}?gmail=connected`);
  } catch {
    return NextResponse.redirect(`${settings}?gmail=exchange_failed`);
  }
}
