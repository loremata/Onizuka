import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCalendarCode, saveGoogleCalendarTokens } from "@/lib/google-calendar-oauth";
import { verifyOAuthState } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const settings = `${process.env.NEXTAUTH_URL?.replace(/\/$/, "")}/admin/settings`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${settings}?calendar=error`);
  }

  const parsed = verifyOAuthState(state);
  if (!parsed || parsed.provider !== "GOOGLE_CALENDAR") {
    return NextResponse.redirect(`${settings}?calendar=invalid_state`);
  }

  try {
    const tokens = await exchangeGoogleCalendarCode(code);
    await saveGoogleCalendarTokens(parsed.userId, tokens);
    return NextResponse.redirect(`${settings}?calendar=connected`);
  } catch {
    return NextResponse.redirect(`${settings}?calendar=exchange_failed`);
  }
}
