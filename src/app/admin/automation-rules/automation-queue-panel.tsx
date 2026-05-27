"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type QueueStatus = {
  redisEnabled: boolean;
  sqsEnabled: boolean;
  pending: number;
  deadLetterPostgres: number;
  redis: { queue: number; dlq: number } | null;
  sqs: { queue: number; dlq: number } | null;
};

export function AutomationQueuePanel({ rules }: { rules: { id: string; name: string }[] }) {
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    void fetch("/api/admin/automation-rules/queue-status")
      .then((r) => r.json())
      .then((d) => setStatus(d as QueueStatus))
      .catch(() => setStatus(null));
  }, [msg]);

  if (rules.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Coda distribuita (n8n-style)</CardTitle>
        <CardDescription>
          Accoda esecuzione regola; il cron <code className="text-xs">/api/cron/automation-queue</code> o notifications
          processa gli step PENDING. Con <code className="text-xs">REDIS_URL</code> la coda è multi-worker + DLQ Redis.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 text-sm">
        <select
          className="h-9 rounded-md border border-input bg-background px-2"
          value={ruleId}
          onChange={(e) => setRuleId(e.target.value)}
        >
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          disabled={pending || !ruleId}
          onClick={() => {
            setMsg(null);
            start(async () => {
              const res = await fetch("/api/admin/automation-rules/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ruleId, payload: { trigger: "manual_queue" } }),
              });
              const data = (await res.json()) as { runId?: string; error?: string };
              setMsg(res.ok ? `Accodato: ${data.runId}` : data.error ?? "Errore");
            });
          }}
        >
          Accoda run
        </Button>
        {status ? (
          <p className="w-full text-xs text-muted-foreground">
            PENDING DB: {status.pending} · DLQ Postgres: {status.deadLetterPostgres}
            {status.sqsEnabled && status.sqs
              ? ` · SQS ${status.sqs.queue} · DLQ ${status.sqs.dlq}`
              : ""}
            {status.redisEnabled && status.redis
              ? ` · Redis ${status.redis.queue} · DLQ ${status.redis.dlq}`
              : !status.sqsEnabled
                ? " · Redis/SQS disabilitati"
                : ""}
          </p>
        ) : null}
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </CardContent>
    </Card>
  );
}
