import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeGa4Code, saveGa4Tokens } from "@/lib/ga4-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const dest = new URL("/admin/analytics/connections", request.url);

  if (!code) {
    dest.searchParams.set("ga4", "error");
    return NextResponse.redirect(dest);
  }

  try {
    const tokens = await exchangeGa4Code(code);
    await saveGa4Tokens(session.user.id, tokens);
    dest.searchParams.set("ga4", "connected");
  } catch (e) {
    console.error("GA4 OAuth callback error", e);
    dest.searchParams.set("ga4", "error");
  }
  return NextResponse.redirect(dest);
}
