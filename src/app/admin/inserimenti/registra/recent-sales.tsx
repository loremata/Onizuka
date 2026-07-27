"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSale, updateSale } from "../actions";

interface Row {
  id: string;
  date: string;
  brand: string;
  lineKey: string;
  offerCode: string | null;
  feeEur: number | null;
  domiciled: boolean;
  notes: string | null;
}

export interface OfferChoice {
  code: string;
  name: string;
  brand: string;
  lineKey: string | null;
  compensoEur: number | null;
}

/** Una pista registrabile del mese, per brand: popola la tendina in modifica. */
export interface LineChoice {
  brand: string;
  key: string;
  label: string;
}

export function RecentSales({
  sales,
  offers = [],
  lines = [],
}: {
  sales: Row[];
  offers?: OfferChoice[];
  lines?: LineChoice[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!sales.length) return <p className="text-sm text-muted-foreground">Ancora nessuna vendita questo mese.</p>;

  const offerName = new Map(offers.map((o) => [`${o.brand}|${o.code}`, o.name]));

  /** Cancellazione DEFINITIVA (niente cestino): si chiede conferma prima, perché
   *  il bottone sta a pochi millimetri da quello di modifica e un tocco sbagliato
   *  cancellerebbe una vendita senza modo di recuperarla. */
  async function remove(s: Row) {
    const descr = `${s.date} · ${s.brand} · ${s.lineKey}`;
    if (!window.confirm(`Cancellare definitivamente questa vendita?\n\n${descr}\n\nL'operazione non è reversibile.`)) {
      return;
    }
    setBusy(s.id);
    setError(null);
    const res = await deleteSale(s.id);
    setBusy(null);
    // l'errore va mostrato: prima il valore di ritorno veniva scartato e la
    // riga restava lì senza che nulla dicesse che la cancellazione era fallita
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error ? (
        <p className="mb-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-950/30">
          {error}
        </p>
      ) : null}
      <ul className="divide-y text-sm">
      {sales.map((s) =>
        editing === s.id ? (
          <li key={s.id} className="py-2">
            <EditRow
              row={s}
              offers={offers}
              lines={lines}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          </li>
        ) : (
          <li key={s.id} className="flex items-center gap-3 py-2">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{s.date.slice(5)}</span>
            <span className="flex-1">
              <span className="font-medium">{s.brand}</span> · {s.lineKey}
              {s.offerCode ? (
                <span className="text-muted-foreground"> · {offerName.get(`${s.brand}|${s.offerCode}`) ?? s.offerCode}</span>
              ) : null}
              {s.feeEur != null ? ` · ${s.feeEur.toLocaleString("it-IT")} €` : ""}
              {s.domiciled ? " · dom." : ""}
              {s.notes?.includes("(dedotto)") ? (
                <span className="ml-1 text-xs text-amber-600" title="MNP/AL dedotto per far quadrare i totali">
                  ⚠
                </span>
              ) : null}
            </span>
            {/* target 40×40: al banco si tocca col dito e i due bottoni fanno
                cose opposte (correggere / cancellare per sempre) */}
            <button
              onClick={() => setEditing(s.id)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-sm text-muted-foreground hover:bg-muted"
              aria-label="Modifica"
              title="Modifica"
            >
              ✎
            </button>
            <button
              onClick={() => remove(s)}
              disabled={busy === s.id}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-sm text-muted-foreground hover:bg-muted hover:text-red-600 disabled:opacity-50"
              aria-label="Elimina"
              title="Elimina definitivamente"
            >
              ✕
            </button>
          </li>
        ),
      )}
      </ul>
    </>
  );
}

/** Modifica inline: i campi che si sbagliano davvero sono pista, canone, data
 *  e — dove il compenso è per-offerta (Fastweb) — l'offerta venduta. */
function EditRow({
  row,
  offers,
  lines,
  onDone,
  onCancel,
}: {
  row: Row;
  offers: OfferChoice[];
  lines: LineChoice[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(row.date);
  const [lineKey, setLineKey] = useState(row.lineKey);
  const [offerCode, setOfferCode] = useState(row.offerCode ?? "");
  const [feeEur, setFeeEur] = useState(row.feeEur == null ? "" : String(row.feeEur).replace(".", ","));
  const [domiciled, setDomiciled] = useState(row.domiciled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // offerte compatibili con brand+pista (o senza pista assegnata a listino)
  const choices = offers.filter((o) => o.brand === row.brand && (o.lineKey === lineKey || o.lineKey == null));

  // Piste selezionabili: solo quelle del piano di QUESTO brand. Prima era un
  // campo di testo libero e un refuso ("ACESSO_FISSO") creava una vendita che
  // valeva 0 € e non compariva in nessuna gara. La pista attuale resta sempre
  // in elenco anche se il piano nel frattempo è cambiato, altrimenti aprire la
  // modifica cambierebbe il dato di nascosto.
  const lineChoices = lines.filter((l) => l.brand === row.brand);
  const lineOptions = lineChoices.some((l) => l.key === row.lineKey)
    ? lineChoices
    : [...lineChoices, { brand: row.brand, key: row.lineKey, label: `${row.lineKey} (fuori piano)` }];

  async function save() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("brand", row.brand);
    fd.set("lineKey", lineKey);
    fd.set("date", date);
    fd.set("offerCode", offerCode);
    if (feeEur.trim()) fd.set("feeEur", feeEur);
    fd.set("domiciled", domiciled ? "true" : "false");
    const res = await updateSale(row.id, fd);
    setSaving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border bg-background px-2 py-1 text-xs"
        />
        <select
          value={lineKey}
          onChange={(e) => setLineKey(e.target.value)}
          aria-label="Pista"
          className="w-40 rounded border bg-background px-2 py-1 text-xs"
        >
          {lineOptions.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <input
          value={feeEur}
          onChange={(e) => setFeeEur(e.target.value)}
          placeholder="canone"
          inputMode="decimal"
          className="w-20 rounded border bg-background px-2 py-1 text-xs"
        />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={domiciled} onChange={(e) => setDomiciled(e.target.checked)} />
          dom.
        </label>
      </div>
      {choices.length ? (
        <select
          value={offerCode}
          onChange={(e) => setOfferCode(e.target.value)}
          className="w-full rounded border bg-background px-2 py-1 text-xs"
        >
          <option value="">— offerta non assegnata —</option>
          {choices.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
              {o.compensoEur != null ? ` (${o.compensoEur.toLocaleString("it-IT")} €)` : ""}
            </option>
          ))}
        </select>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Salvo…" : "Salva"}
        </button>
        <button onClick={onCancel} className="rounded border px-3 py-1 text-xs">
          Annulla
        </button>
      </div>
    </div>
  );
}
