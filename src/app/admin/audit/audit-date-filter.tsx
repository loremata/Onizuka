"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ADMIN_AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_TYPE_LABELS,
  AUDIT_ENTITY_TYPES,
  AUDIT_FILTER_ACTIONS,
} from "@/lib/admin-audit-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Filters = {
  action?: string;
  entity?: string;
};

export function AuditDateFilter({ filters }: { filters: Filters }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [actor, setActor] = useState(searchParams.get("actor") ?? "");
  const [action, setAction] = useState(filters.action ?? "");
  const [entity, setEntity] = useState(filters.entity ?? "");

  function apply() {
    const p = new URLSearchParams();
    if (action) p.set("action", action);
    if (entity) p.set("entity", entity);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (actor.trim()) p.set("actor", actor.trim());
    const q = p.toString();
    router.push(q ? `/admin/audit?${q}` : "/admin/audit");
  }

  function reset() {
    setFrom("");
    setTo("");
    setActor("");
    setAction("");
    setEntity("");
    router.push("/admin/audit");
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-muted/20 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div>
        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Azione</label>
        <Select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Tutte</option>
          {AUDIT_FILTER_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ADMIN_AUDIT_ACTION_LABELS[a] ?? a}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Entità</label>
        <Select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Tutte</option>
          {AUDIT_ENTITY_TYPES.map((e) => (
            <option key={e} value={e}>
              {AUDIT_ENTITY_TYPE_LABELS[e] ?? e}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Da</label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">A</label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px] text-xs" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Attore (email o sistema)</label>
        <Input
          type="text"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="admin@… o sistema"
          className="h-8 w-[180px] text-xs"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" className="h-8">
        Filtra
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={reset}>
        Reset
      </Button>
    </form>
  );
}
