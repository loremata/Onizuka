import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGbpBusinessCode,
  saveGbpBusinessTokens,
} from "@/lib/gbp-business-oauth";
import { verifyOAuthState } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const settings = `${process.env.NEXTAUTH_URL?.replace(/\/$/, "")}/admin/settings`;

  if (url.searchParams.get("error") || !code || !state) {
    return NextResponse.redirect(`${settings}?gbp=error`);
  }

  const parsed = verifyOAuthState(state);
  if (!parsed || parsed.provider !== "GOOGLE_GBP") {
    return NextResponse.redirect(`${settings}?gbp=invalid_state`);
  }

  try {
    const tokens = await exchangeGbpBusinessCode(code);
    await saveGbpBusinessTokens(parsed.userId, tokens);
    return NextResponse.redirect(`${settings}?gbp=connected`);
  } catch {
    return NextResponse.redirect(`${settings}?gbp=exchange_failed`);
  }
}
