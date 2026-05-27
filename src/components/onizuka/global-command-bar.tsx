"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { orchestrateAsk } from "@/lib/ask-orchestration";
import { CommandIntentHint } from "@/components/onizuka/command-intent-hint";

export function GlobalCommandBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const spAsk = searchParams.get("ask") ?? "";
  const spQ = searchParams.get("q") ?? "";
  const [value, setValue] = useState(spAsk || spQ);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pathname?.startsWith("/admin/search") && spQ) {
      setValue(spQ);
    } else if (spAsk) {
      setValue(spAsk);
    }
  }, [pathname, spAsk, spQ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const q = value.trim();
      if (!q) return;
      const plan = orchestrateAsk(q);
      if (plan.primary.kind === "prospect_vat") {
        try {
          const res = await fetch("/api/admin/prospect-from-vat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: q }),
          });
          const data = (await res.json()) as { error?: string; auditId?: string; approvalsHref?: string };
          if (!res.ok) {
            router.push(`/admin/audit/digital?error=${encodeURIComponent(data.error ?? "Errore pipeline")}`);
            return;
          }
          if (data.auditId) {
            router.push(`/admin/audit/digital/${data.auditId}?queued=1`);
            return;
          }
          router.push(data.approvalsHref ?? "/admin/approvals");
        } catch {
          router.push("/admin/audit/digital");
        }
        return;
      }
      router.push(plan.primaryHref);
    },
    [value, router]
  );

  return (
    <div className="border-b border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
      <CommandIntentHint query={value} />
      <form
        onSubmit={onSubmit}
        className="container mx-auto flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3"
        role="search"
        aria-label="Comando Onizuka"
      >
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/90">
          Comando
        </span>
        <Input
          ref={inputRef}
          name="ask"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="P.IVA prospect, clienti, pipeline, cross-sell… (Ctrl+K)"
          className="h-9 flex-1 border-primary/20 bg-background/60 text-sm ring-offset-background focus-visible:ring-primary/40"
          autoComplete="off"
        />
        <Button type="submit" size="sm" className="shrink-0">
          Esegui
        </Button>
      </form>
    </div>
  );
}
