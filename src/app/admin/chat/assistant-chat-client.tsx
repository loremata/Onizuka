"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ThreadRow = {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export function AssistantChatClient({
  initialThreads,
}: {
  initialThreads: ThreadRow[];
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(initialThreads[0]?.id ?? null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/admin/assistant/threads/${threadId}/messages`);
    if (!res.ok) return;
    const data = (await res.json()) as { messages: MessageRow[] };
    setMessages(data.messages);
  }, []);

  const selectThread = async (id: string) => {
    setActiveId(id);
    await loadMessages(id);
  };

  const newThread = async () => {
    const res = await fetch("/api/admin/assistant/threads", { method: "POST" });
    if (!res.ok) return;
    const data = (await res.json()) as { thread: ThreadRow };
    setThreads((t) => [data.thread, ...t]);
    setActiveId(data.thread.id);
    setMessages([]);
  };

  const send = async () => {
    if (!activeId || !input.trim()) return;
    setLoading(true);
    const text = input.trim();
    setInput("");
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() },
    ]);
    const res = await fetch(`/api/admin/assistant/threads/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setLoading(false);
    if (!res.ok) return;
    await loadMessages(activeId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Thread</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button size="sm" variant="outline" onClick={() => void newThread()}>
            Nuova chat
          </Button>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto text-sm">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left hover:bg-muted ${
                    activeId === t.id ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => void selectThread(t.id)}
                >
                  {t.title}
                  <span className="block text-xs text-muted-foreground">{t._count.messages} msg</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="flex min-h-[480px] flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversazione</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          {!activeId ? (
            <p className="text-sm text-muted-foreground">Crea o seleziona un thread.</p>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto rounded border p-3 text-sm">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground">Nessun messaggio. Scrivi per iniziare.</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={
                        msg.role === "user"
                          ? "ml-auto max-w-[85%] rounded bg-primary/10 px-3 py-2"
                          : "max-w-[85%] rounded bg-muted px-3 py-2"
                      }
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Messaggio…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  disabled={loading}
                />
                <Button onClick={() => void send()} disabled={loading || !input.trim()}>
                  Invia
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
