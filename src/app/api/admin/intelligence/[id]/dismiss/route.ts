import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { requireAdminApiSession } from "@/lib/api-admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminApiSession("/admin/intelligence");
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  await prisma.intelligenceRecommendation.updateMany({
    where: { id, ownerUserId: (session as Session).user.id },
    data: { dismissedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
