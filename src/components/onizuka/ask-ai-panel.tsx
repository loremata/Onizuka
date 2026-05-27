"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AskPayload = {
  mode: "llm" | "rules";
  answer: string;
  primaryHref: string;
  primaryLabel: string;
  memoryHits: Array<{
    id: string;
    title: string;
    snippet: string;
    href: string;
    clientName: string | null;
  }>;
  followUps: Array<{ label: string; href: string }>;
};

export function AskAiPanel({ query }: { query: string }) {
  const [data, setData] = useState<AskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/admin/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: query }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("ask");
        return res.json() as Promise<AskPayload>;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("Assistente non disponibile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Assistente Onizuka</CardTitle>
        <CardDescription>
          {loading
            ? "Analisi in corso…"
            : data?.mode === "llm"
              ? "Risposta AI con contesto memoria"
              : "Routing moduli + memoria (senza LLM)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {data ? (
          <>
            <p className="whitespace-pre-wrap">{data.answer}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={data.primaryHref}>{data.primaryLabel}</Link>
              </Button>
              {data.followUps.slice(0, 3).map((f) => (
                <Button key={f.href} asChild size="sm" variant="outline">
                  <Link href={f.href}>{f.label}</Link>
                </Button>
              ))}
            </div>
            {data.memoryHits.length > 0 ? (
              <div className="space-y-2 border-t border-border/60 pt-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Memoria correlata</p>
                <ul className="space-y-2">
                  {data.memoryHits.map((h) => (
                    <li key={h.id}>
                      <Link href={h.href} className="font-medium text-primary hover:underline">
                        {h.title}
                      </Link>
                      {h.clientName ? (
                        <span className="text-muted-foreground"> · {h.clientName}</span>
                      ) : null}
                      <p className="text-xs text-muted-foreground line-clamp-2">{h.snippet}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
