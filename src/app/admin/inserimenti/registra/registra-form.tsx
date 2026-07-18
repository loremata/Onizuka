"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { recordSale, deleteSale } from "../actions";

export interface BrandOption {
  brand: string;
  label: string;
  lines: { key: string; label: string; unit: string; status: string }[];
}

/** Form di registrazione in blocco: la data resta impostata fra una vendita e
 *  l'altra (§A.16), brand→pista a cascata, canone solo per le piste TIM. */
export function RegistraForm({ options, today }: { options: BrandOption[]; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [brand, setBrand] = useState(options[0]?.brand ?? "TIM");
  const [lineKey, setLineKey] = useState("");
  const [feeEur, setFeeEur] = useState("");
  const [domiciled, setDomiciled] = useState(false);
  const [provenance, setProvenance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLabel, setLastLabel] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const brandOpt = useMemo(() => options.find((o) => o.brand === brand), [options, brand]);
  const line = useMemo(() => brandOpt?.lines.find((l) => l.key === lineKey), [brandOpt, lineKey]);
  /** Piste filtrate dalla ricerca: con TIM + Fastweb insieme la lista è lunga. */
  const visibleLines = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = brandOpt?.lines ?? [];
    if (!t) return all;
    return all.filter((l) => (l.label + " " + l.key).toLowerCase().includes(t));
  }, [brandOpt, q]);
  const needsFee = brand === "TIM" && line?.unit === "MULTIPLIER_ON_FEE";
  const isMnp = line?.key === "MNP";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lineKey) {
      setError("Seleziona una pista.");
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("brand", brand);
    fd.set("lineKey", lineKey);
    fd.set("date", date);
    if (needsFee) {
      fd.set("feeEur", feeEur);
      fd.set("feeSource", "MANUALE");
      fd.set("domiciled", domiciled ? "true" : "false");
    }
    if (isMnp && provenance) fd.set("provenance", provenance);
    const res = await recordSale(fd);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    // registrazione in blocco: tieni data e brand, azzera il resto
    setLastLabel(`${brand} · ${line?.label ?? lineKey}${needsFee && feeEur ? ` · ${feeEur} €` : ""}`);
    setLastId(res.id);
    setFeeEur("");
    setDomiciled(false);
    setProvenance("");
    router.refresh();
  }

  /** Annulla l'ultima registrazione: al banco si sbaglia, e cancellare dalla
   *  lista è più lento che premere "annulla" subito. */
  async function undo() {
    if (!lastId) return;
    await deleteSale(lastId);
    setLastId(null);
    setLastLabel(null);
    router.refresh();
  }

  const billWarn =
    needsFee && feeEur
      ? (() => {
          const f = parseFloat(feeEur.replace(",", "."));
          if (!Number.isFinite(f)) return null;
          if (f < 8) return "⚠️ Sotto 8 €: NON paga il gettone di gara (conta solo per la soglia).";
          if (f < 9) return "⚠️ Tra 8 e 8,99 €: gettone al 50%. Sopra 9 € vale doppio.";
          return null;
        })()
      : null;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <span className="text-xs text-muted-foreground">Resta impostata per le vendite successive.</span>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Brand</span>
          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setLineKey("");
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {options.map((o) => (
              <option key={o.brand} value={o.brand}>
                {o.brand}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Pista / prodotto</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca…"
          className="mb-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select
          value={lineKey}
          onChange={(e) => setLineKey(e.target.value)}
          size={Math.min(8, Math.max(3, visibleLines.length + 1))}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— scegli —</option>
          {visibleLines.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
              {l.status !== "ATTIVA" ? ` (${l.status.toLowerCase()})` : ""}
            </option>
          ))}
        </select>
      </div>

      {needsFee ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Canone € (del cliente)</span>
            <input
              inputMode="decimal"
              value={feeEur}
              onChange={(e) => setFeeEur(e.target.value)}
              placeholder="es. 9,99"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" checked={domiciled} onChange={(e) => setDomiciled(e.target.checked)} />
            <span className="text-sm">Domiciliato (ric. automatica / easy)</span>
          </label>
        </div>
      ) : null}

      {isMnp ? (
        <label className="space-y-1 block">
          <span className="text-xs font-medium text-muted-foreground">Provenienza (per le MNP)</span>
          <select
            value={provenance}
            onChange={(e) => setProvenance(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {["ILIAD", "COOP", "POSTE", "FASTWEB", "ALTRO"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {billWarn ? <p className="text-sm text-amber-700 dark:text-amber-300">{billWarn}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {lastLabel ? (
        <p className="flex items-center gap-3 text-sm text-green-700 dark:text-green-400">
          <span>✓ Registrata: {lastLabel}</span>
          {lastId ? (
            <button type="button" onClick={undo} className="underline hover:no-underline">
              annulla
            </button>
          ) : null}
        </p>
      ) : null}

      <Button type="submit" disabled={saving}>
        {saving ? "Salvo…" : "Registra e continua"}
      </Button>
    </form>
  );
}
