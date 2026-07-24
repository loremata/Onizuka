"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import type { Opportunity } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOpportunity, updateOpportunity, type OpportunityActionResult } from "./actions";
import {
  opportunityPriorityLabel,
  opportunityPriorityOptions,
  opportunityStatusLabel,
  opportunityStatusOptions,
} from "@/lib/crm-opportunity";
import { Select } from "@/components/ui/select";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : label}
    </Button>
  );
}

const initial: OpportunityActionResult = null;

type ClientOpt = { id: string; companyName: string };
type LeadOpt = { id: string; title: string; businessName: string | null };

export type AssetOption = { id: string; clientId: string; name: string };

type Props = {
  clients: ClientOpt[];
  leads?: LeadOpt[];
  assets: AssetOption[];
  opportunity?: Opportunity;
  /** Preselezione cliente in creazione (es. arrivo da "Proponi" con ?clientId=). */
  presetClientId?: string;
  /** Titolo precompilato in creazione (es. nome servizio da ?service=). */
  presetTitle?: string;
};

function dueInputValue(d: Date | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function OpportunityForm({
  clients,
  leads = [],
  assets,
  opportunity,
  presetClientId,
  presetTitle,
}: Props) {
  const isEdit = !!opportunity;
  const defaultClientId = opportunity?.clientId ?? presetClientId ?? "";
  const defaultLeadId = opportunity?.leadId ?? "";
  const initialAssetId =
    opportunity?.assetId &&
    assets.some((a) => a.id === opportunity.assetId && a.clientId === defaultClientId)
      ? opportunity.assetId
      : "";

  const [clientId, setClientId] = useState(defaultClientId);
  const [assetId, setAssetId] = useState(initialAssetId);

  const [state, formAction] = useFormState(
    isEdit
      ? (_p: OpportunityActionResult, fd: FormData) => updateOpportunity(opportunity.id, _p, fd)
      : createOpportunity,
    initial
  );

  const assetChoices = assets.filter((a) => a.clientId === clientId);

  return (
    <form action={formAction} className="space-y-4">
      {state && "error" in state && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="clientId">Cliente (opzionale se c&apos;è un lead)</Label>
          <Select
            id="clientId"
            name="clientId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => {
              const next = e.target.value;
              setClientId(next);
              setAssetId((prev) => {
                const keep = assets.some((a) => a.id === prev && a.clientId === next);
                return keep ? prev : "";
              });
            }}
          >
            <option value="">— Nessun cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="leadId">Lead collegato</Label>
          <Select
            id="leadId"
            name="leadId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={defaultLeadId}
          >
            <option value="">— Nessun lead —</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.businessName ?? l.title}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">Almeno cliente o lead richiesto.</p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Titolo opportunità</Label>
          <Input id="title" name="title" required defaultValue={opportunity?.title ?? presetTitle} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Stato</Label>
          <Select
            id="status"
            name="status"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={opportunity?.status ?? "OPEN"}
          >
            {opportunityStatusOptions.map((s) => (
              <option key={s} value={s}>
                {opportunityStatusLabel[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priorità</Label>
          <Select
            id="priority"
            name="priority"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue={opportunity?.priority ?? "MEDIUM"}
          >
            {opportunityPriorityOptions.map((p) => (
              <option key={p} value={p}>
                {opportunityPriorityLabel[p]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedValue">Valore stimato (€)</Label>
          <Input
            id="estimatedValue"
            name="estimatedValue"
            inputMode="decimal"
            defaultValue={opportunity?.estimatedValue != null ? String(opportunity.estimatedValue) : ""}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="probability">Probabilità % (0–100)</Label>
          <Input
            id="probability"
            name="probability"
            inputMode="numeric"
            defaultValue={opportunity?.probability != null ? String(opportunity.probability) : ""}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="assetId">Asset (opzionale)</Label>
          <Select
            id="assetId"
            name="assetId"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            <option value="">— Nessun asset —</option>
            {assetChoices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          {assetChoices.length === 0 && clientId ? (
            <p className="text-xs text-muted-foreground">
              Nessun asset per questo cliente.{" "}
              <Link className="text-primary underline-offset-4 hover:underline" href={`/admin/clients/${clientId}/assets/new`}>
                Crea un asset
              </Link>
            </p>
          ) : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nextAction">Prossima azione</Label>
          <Input id="nextAction" name="nextAction" defaultValue={opportunity?.nextAction ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="dueDate">Scadenza (opzionale)</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="datetime-local"
            defaultValue={dueInputValue(opportunity?.dueDate)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Descrizione</Label>
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={opportunity?.description ?? ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Submit label={isEdit ? "Salva" : "Crea opportunità"} />
        <Button asChild type="button" variant="outline">
          <Link href="/admin/crm/opportunities">Annulla</Link>
        </Button>
      </div>
    </form>
  );
}
