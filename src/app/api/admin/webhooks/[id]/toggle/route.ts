import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sub = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.webhookSubscription.update({
    where: { id },
    data: { isActive: !sub.isActive },
  });

  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/admin/webhooks`);
}
