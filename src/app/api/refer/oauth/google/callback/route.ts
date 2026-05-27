import { NextRequest, NextResponse } from "next/server";
import { completeReferrerGoogleOAuth } from "@/lib/referrer-google-oauth";
import { publicReferBaseUrl } from "@/lib/referrer-magic-link";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const base = publicReferBaseUrl();

  if (!code || !state) {
    return NextResponse.redirect(`${base}/refer?error=oauth`);
  }

  const result = await completeReferrerGoogleOAuth({ code, state });
  if ("error" in result) {
    return NextResponse.redirect(`${base}/refer?error=${encodeURIComponent(result.error)}`);
  }

  return NextResponse.redirect(`${base}/refer?oauth=ok`);
}
