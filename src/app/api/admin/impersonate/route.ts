import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole, isFullAdmin } from "@/lib/auth-roles";
import { clearClientPreviewCookie, setClientPreviewCookie } from "@/lib/client-impersonation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Solo ADMIN può aprire il portale cliente." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { clientId?: string };
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId) return NextResponse.json({ error: "clientId obbligatorio." }, { status: 400 });

  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: { id: true, companyName: true },
  });
  if (!client) return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });

  await setClientPreviewCookie(session.user.id, clientId);

  return NextResponse.json({ ok: true, redirectUrl: "/app/dashboard" });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  await clearClientPreviewCookie();
  return NextResponse.json({ ok: true, redirectUrl: "/admin/clients" });
}
