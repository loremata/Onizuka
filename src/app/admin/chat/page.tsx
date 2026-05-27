import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { AssistantChatClient } from "./assistant-chat-client";

export default async function AdminChatPage() {
  const session = await requireAdminArea();

  const threads = await prisma.assistantChatThread.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assistente chat</h1>
        <p className="text-muted-foreground">
          Thread persistenti con memoria RAG e contesto operativo (complemento alla barra Ask).
        </p>
      </div>
      <AssistantChatClient
        initialThreads={threads.map((t) => ({
          ...t,
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
