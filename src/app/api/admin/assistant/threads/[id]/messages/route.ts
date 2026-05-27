import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonApiError } from "@/lib/api-json-errors";
import { replyAssistantChat, touchAssistantThread } from "@/lib/assistant-chat";
import { prisma } from "@/lib/prisma";

async function adminSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminSession();
  if (!session) return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");

  const { id } = await params;
  const thread = await prisma.assistantChatThread.findFirst({
    where: { id, ownerUserId: session.user.id },
    select: { id: true },
  });
  if (!thread) return jsonApiError(404, "NOT_FOUND", "Thread non trovato.");

  const messages = await prisma.assistantChatMessage.findMany({
    where: { threadId: id },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await adminSession();
  if (!session) return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");

  const { id } = await params;
  const thread = await prisma.assistantChatThread.findFirst({
    where: { id, ownerUserId: session.user.id },
    select: { id: true, title: true },
  });
  if (!thread) return jsonApiError(404, "NOT_FOUND", "Thread non trovato.");

  let body: { content?: string };
  try {
    body = (await request.json()) as { content?: string };
  } catch {
    return jsonApiError(400, "INVALID_JSON", "JSON non valido.");
  }

  const content = (body.content ?? "").trim();
  if (!content) return jsonApiError(400, "INVALID_JSON", "Messaggio vuoto.");

  await prisma.assistantChatMessage.create({
    data: { threadId: id, role: "user", content },
  });

  const { content: answer } = await replyAssistantChat(session.user.id, id, content);

  await prisma.assistantChatMessage.create({
    data: { threadId: id, role: "assistant", content: answer },
  });

  if (thread.title === "Nuova chat") {
    const short = content.slice(0, 48);
    await prisma.assistantChatThread.update({
      where: { id },
      data: { title: short.length < content.length ? `${short}…` : short },
    });
  }

  await touchAssistantThread(id);

  return NextResponse.json({ ok: true });
}
