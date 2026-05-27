import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildErpOAuthUrl, isSapOAuthConfigured, isZucchettiOAuthConfigured } from "@/lib/erp-oauth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get("provider")?.trim();
  if (provider === "zucchetti" && !isZucchettiOAuthConfigured()) {
    return NextResponse.json({ error: "Zucchetti OAuth non configurato." }, { status: 503 });
  }
  if (provider === "sap" && !isSapOAuthConfigured()) {
    return NextResponse.json({ error: "SAP OAuth non configurato." }, { status: 503 });
  }

  const oauthProvider = provider === "sap" ? "SAP_ERP" : "ZUCCHETTI_ERP";
  const url = buildErpOAuthUrl(oauthProvider, session.user.id);
  if (!url) return NextResponse.json({ error: "URL OAuth non disponibile." }, { status: 503 });
  return NextResponse.redirect(url);
}
