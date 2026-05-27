import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-json-errors";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");
  }

  const thread = await prisma.assistantChatThread.create({
    data: {
      ownerUserId: session.user.id,
      title: "Nuova chat",
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    thread: { ...thread, updatedAt: thread.updatedAt.toISOString() },
  });
}
