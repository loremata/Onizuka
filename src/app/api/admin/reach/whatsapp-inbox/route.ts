import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const messages = await prisma.whatsAppInboundMessage.findMany({
    orderBy: { receivedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      phoneFrom: m.phoneFrom,
      body: m.body,
      receivedAt: m.receivedAt.toISOString(),
    })),
  });
}
