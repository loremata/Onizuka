import { NextRequest, NextResponse } from "next/server";
import type { OAuthProvider } from "@prisma/client";
import { completeErpOAuth } from "@/lib/erp-oauth";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerParam = url.searchParams.get("provider");
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  if (!code || !state) {
    return NextResponse.redirect(`${base}/admin/time?erp_oauth=error`);
  }

  const provider: OAuthProvider =
    providerParam === "SAP_ERP" ? "SAP_ERP" : "ZUCCHETTI_ERP";

  const result = await completeErpOAuth({ provider, code, state });
  if ("error" in result) {
    return NextResponse.redirect(`${base}/admin/time?erp_oauth=${encodeURIComponent(result.error)}`);
  }

  return NextResponse.redirect(`${base}/admin/time?erp_oauth=ok`);
}
