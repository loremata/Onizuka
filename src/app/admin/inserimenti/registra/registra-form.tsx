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

export interface OfferOption {
  code: string;
  name: string;
  brand: string;
  feeEur: number;
  lineKey: string | null;
}

/** Form di registrazione in blocco: la data resta impostata fra una vendita e
 *  l'altra (§A.16), brand→pista a cascata, canone solo per le piste TIM. */
export function RegistraForm({
  options,
  today,
  offers = [],
}: {
  options: BrandOption[];
  today: string;
  offers?: OfferOption[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [brand, setBrand] = useState(options[0]?.brand ?? "TIM");
  const [lineKey, setLineKey] = useState("");
  const [offerCode, setOfferCode] = useState("");
  const [feeEur, setFeeEur] = useState("");
  const [domiciled, setDomiciled] = useState(false);
  const [provenance, setProvenance] = useState("");
  const [fwaRic, setFwaRic] = useState(false);
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
  // il canone serve ovunque il compenso lo moltiplichi: gare TIM, business
  // Fastweb (5 × canone), Iliad (1 × canone). Non dipende dal brand.
  const isFisso = brand === "TIM" && line?.key === "ACCESSO_FISSO";
  // FWA ricaricabile: niente canone mensile, conta solo il pezzo (peso 0,5)
  const isFwaRic = isFisso && fwaRic;
  const needsFee = line?.unit === "MULTIPLIER_ON_FEE" && !isFwaRic;
  const isMnp = brand === "TIM" && line?.key === "MNP";
  // il bill size è una regola TIM: altrove non c'è soglia minima di canone
  const showBillWarning = brand === "TIM";

  /** Offerte compatibili: quelle mappate su questa pista + quelle senza pista
   *  (categorie ambigue del listino, es. Convergenza, che possono essere MNP o AL).
   *  Servono anche dove il canone non conta, perché il compenso può cambiare da
   *  un'offerta all'altra (Fastweb: Casa Start e Casa Ultra non pagano uguale). */
  const offerChoices = useMemo(() => {
    if (!lineKey) return [];
    return offers
      .filter((o) => o.brand === brand && (o.lineKey === lineKey || o.lineKey == null))
      .sort((a, b) => a.feeEur - b.feeEur || a.name.localeCompare(b.name));
  }, [offers, brand, lineKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lineKey) {
      setError("Seleziona una pista.");
      return;
    }
    // canone obbligatorio dove moltiplica il compenso (senza sarebbe uno 0 silenzioso)
    if (needsFee && !feeEur.trim()) {
      setError("Inserisci il canone dell'offerta venduta: qui il compenso è moltiplicatore × canone.");
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("brand", brand);
    fd.set("lineKey", lineKey);
    fd.set("date", date);
    if (offerCode) fd.set("offerCode", offerCode);
    if (isFwaRic) fd.set("subtype", "FWA_RIC");
    if (needsFee) {
      fd.set("feeEur", feeEur);
      fd.set("feeSource", offerCode ? "LISTINO" : "MANUALE");
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
    setLastLabel(
      `${brand} · ${line?.label ?? lineKey}${isFwaRic ? " · FWA ric" : ""}${needsFee && feeEur ? ` · ${feeEur} €` : ""}`,
    );
    setLastId(res.id);
    setFeeEur("");
    setOfferCode("");
    setDomiciled(false);
    setProvenance("");
    setFwaRic(false);
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
    needsFee && showBillWarning && feeEur
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
          onChange={(e) => {
            setLineKey(e.target.value);
            setFwaRic(false);
          }}
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

      {offerChoices.length ? (
        <label className="space-y-1 block">
          <span className="text-xs font-medium text-muted-foreground">
            Offerta dal listino ({offerChoices.length})
          </span>
          <select
            value={offerCode}
            onChange={(e) => {
              const code = e.target.value;
              setOfferCode(code);
              const o = offerChoices.find((x) => x.code === code);
              if (o && o.feeEur > 0) setFeeEur(String(o.feeEur).replace(".", ","));
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">— scegli l&apos;offerta —</option>
            {offerChoices.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
                {o.feeEur > 0 ? ` — ${o.feeEur.toLocaleString("it-IT", { minimumFractionDigits: 2 })} €` : ""}
                {showBillWarning && o.feeEur > 0 && o.feeEur < 8 ? " ⚠ no gettone" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {needsFee
              ? "Puoi comunque scrivere il canone a mano se l'offerta non è in listino."
              : "Serve a sapere cosa hai venduto: il compenso può cambiare da un'offerta all'altra."}
          </span>
        </label>
      ) : null}

      {isFisso ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={fwaRic} onChange={(e) => setFwaRic(e.target.checked)} />
          <span className="text-sm">
            FWA Ricaricabile <span className="text-muted-foreground">(pesa 0,5 sulla soglia, senza canone)</span>
          </span>
        </label>
      ) : null}

      {needsFee ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Canone € (del cliente) <span className="text-red-600">*obbligatorio</span>
            </span>
            <input
              inputMode="decimal"
              value={feeEur}
              onChange={(e) => {
                setFeeEur(e.target.value);
                setOfferCode(""); // scritto a mano → non è più dal listino
              }}
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
