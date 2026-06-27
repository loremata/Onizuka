"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type SandboxResult = {
  matched: boolean;
  note: string;
  dryRun: boolean;
  branches: { id: string; label?: string; matched: boolean }[];
  rendered: { subject: string | null; body: string | null; webhook: string | null };
};

export function AutomationSandboxPanel({ rules }: { rules: { id: string; name: string }[] }) {
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [payload, setPayload] = useState("{}");
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (rules.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Sandbox live (dry-run)</CardTitle>
        <CardDescription>
          Valuta condizioni e branch senza inviare email, webhook o Telegram e senza scrivere log di esecuzione.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Select
          className="h-10 w-full rounded-md border border-input bg-background px-3"
          value={ruleId}
          onChange={(e) => setRuleId(e.target.value)}
        >
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <textarea
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder='{"leadStatus":"NEW"}'
        />
        <Button
          type="button"
          size="sm"
          disabled={pending || !ruleId}
          onClick={() => {
            setError(null);
            setResult(null);
            start(async () => {
              const res = await fetch("/api/admin/automation-rules/sandbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ruleId, payloadJson: payload }),
              });
              const data = (await res.json()) as SandboxResult & { error?: string };
              if (!res.ok) {
                setError(data.error ?? "Sandbox fallita.");
                return;
              }
              setResult(data);
            });
          }}
        >
          Esegui sandbox
        </Button>
        {error ? <p className="text-destructive">{error}</p> : null}
        {result ? (
          <div className="rounded-md bg-muted/40 p-3 space-y-2">
            <p>
              <strong>{result.matched ? "Match" : "No match"}</strong> — {result.note}
            </p>
            {result.branches.length > 0 ? (
              <ul className="text-xs">
                {result.branches.map((b) => (
                  <li key={b.id}>
                    Branch {b.label ?? b.id}: {b.matched ? "OK" : "—"}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.rendered.subject ? <p className="text-xs">Subject: {result.rendered.subject}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
