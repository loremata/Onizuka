"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { recordSale, deleteSale, searchClientsForCounter, createClientFromCounter } from "../actions";
import { ACCESSO_SUBTYPES, isAccessoSenzaCanone, type AccessoSubtype } from "@/lib/inserimenti/accesso-subtypes";

type CounterHit = { id: string; companyName: string; phone: string | null; isLead: boolean };

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
  const [accessoTipo, setAccessoTipo] = useState("");
  const [contenutoTipo, setContenutoTipo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLabel, setLastLabel] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  // Aggancio CRM opzionale della vendita (facoltativo, non blocca il banco).
  const [clientId, setClientId] = useState("");
  const [clientQ, setClientQ] = useState("");
  const [hits, setHits] = useState<CounterHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedClient, setPickedClient] = useState<{ companyName: string; reused: boolean } | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [clientErr, setClientErr] = useState<string | null>(null);

  // Ricerca a digitazione, con pausa: al banco si scrive in fretta e non ha
  // senso interrogare il database a ogni tasto.
  useEffect(() => {
    const term = clientQ.trim();
    if (pickedClient || term.length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    const h = setTimeout(async () => {
      const res = await searchClientsForCounter(term).catch(() => []);
      setHits(res);
      setSearching(false);
      // Precompilo la creazione con quello che ha gia' scritto.
      if (/\d/.test(term) && term.replace(/\D/g, "").length >= 8) setNewPhone((p) => p || term);
      else setNewName((n) => n || term);
    }, 300);
    return () => clearTimeout(h);
  }, [clientQ, pickedClient]);

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
  // Tre sottotipi di accesso contano per la soglia ma non prendono il gettone,
  // e nessuno dei tre ha un canone da chiedere (vedi accesso-subtypes.ts).
  const accessoSenzaCanone = isFisso && isAccessoSenzaCanone("ACCESSO_FISSO", accessoTipo);
  const needsFee = line?.unit === "MULTIPLIER_ON_FEE" && !accessoSenzaCanone;
  const isMnp = brand === "TIM" && line?.key === "MNP";
  // Contenuti: i bundle multi-OTT valgono più pezzi (TIMVision L = 3 OTT = 3 pezzi)
  const isContenuti = brand === "TIM" && line?.key === "CONTENUTI";
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
    if (isFisso && accessoTipo) fd.set("subtype", accessoTipo);
    if (isContenuti && contenutoTipo) fd.set("subtype", contenutoTipo);
    if (needsFee) {
      fd.set("feeEur", feeEur);
      fd.set("feeSource", offerCode ? "LISTINO" : "MANUALE");
      fd.set("domiciled", domiciled ? "true" : "false");
    }
    if (isMnp && provenance) fd.set("provenance", provenance);
    // Cliente OPZIONALE: se selezionato, aggancia la vendita al CRM.
    if (clientId) fd.set("clientId", clientId);
    const res = await recordSale(fd);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    // registrazione in blocco: tieni data e brand, azzera il resto
    setLastLabel(
      `${brand} · ${line?.label ?? lineKey}${isFisso && accessoTipo ? ` · ${ACCESSO_SUBTYPES[accessoTipo as AccessoSubtype].label}` : ""}` +
        `${isContenuti && contenutoTipo ? ` · ${contenutoTipo}` : ""}` +
        `${needsFee && feeEur ? ` · ${feeEur} €` : ""}`,
    );
    setLastId(res.id);
    setFeeEur("");
    setOfferCode("");
    setDomiciled(false);
    setProvenance("");
    setAccessoTipo("");
    // Azzero il tipo contenuto: se restasse "TIMVision L" le registrazioni
    // successive conterebbero 3 pezzi ciascuna, e il subtype non è correggibile
    // dalla UI (updateSale non lo tocca) — si potrebbe solo cancellare la vendita.
    setContenutoTipo("");
    // Azzero anche il cliente: evita di agganciare per sbaglio la vendita
    // successiva allo stesso cliente. Va riselezionato quando serve.
    setClientId("");
    setClientQ("");
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
            setAccessoTipo("");
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
        <label className="space-y-1 block">
          <span className="text-xs font-medium text-muted-foreground">
            Tipo di accesso{" "}
            <span className="font-normal">— gli ultimi tre contano per la soglia ma non prendono il gettone</span>
          </span>
          <select
            value={accessoTipo}
            onChange={(e) => setAccessoTipo(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Accesso a canone — fibra, FWA, FLEXY</option>
            {(Object.keys(ACCESSO_SUBTYPES) as AccessoSubtype[]).map((k) => (
              <option key={k} value={k}>
                {ACCESSO_SUBTYPES[k].label} — {ACCESSO_SUBTYPES[k].hint}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {needsFee ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Canone € IVA inclusa <span className="text-red-600">*obbligatorio</span>
            </span>
            <input
              inputMode="decimal"
              value={feeEur}
              onChange={(e) => {
                setFeeEur(e.target.value);
                setOfferCode(""); // scritto a mano → non è più dal listino
              }}
              placeholder="es. 29,90"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <span className="block text-[11px] text-muted-foreground">
              Il prezzo che paga il cliente, come da listino (es. TIM WiFi Casa 29,90).
              È la base su cui il gestore calcola il moltiplicatore.
            </span>
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

      {isContenuti ? (
        <label className="space-y-1 block">
          <span className="text-xs font-medium text-muted-foreground">
            Tipo contenuto{" "}
            <span className="font-normal">— i bundle multi-OTT contano più pezzi sulla gara</span>
          </span>
          <select
            value={contenutoTipo}
            onChange={(e) => setContenutoTipo(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Standard — 1 OTT, 1 pezzo</option>
            <option value="TIMVISION_M">TIMVision M (Netflix + Disney+) — 2 pezzi</option>
            <option value="TIMVISION_L">TIMVision L (Netflix + Disney+ + Prime) — 3 pezzi</option>
            <option value="DAZN10">Dazn completo — 3 pezzi</option>
            <option value="MYCLUB">MyClub — 2 pezzi</option>
          </select>
        </label>
      ) : null}

      <div className="space-y-2 rounded-md border border-dashed p-3">
        <span className="text-xs font-medium text-muted-foreground">
          Cliente (facoltativo){" "}
          <span className="font-normal">— aggancia la vendita alla scheda e attiva il servizio</span>
        </span>

        {pickedClient ? (
          <p className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              👤 {pickedClient.companyName}
              {pickedClient.reused ? (
                <span className="ml-2 text-xs text-muted-foreground">(già a sistema)</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => {
                setPickedClient(null);
                setClientId("");
                setClientQ("");
                setHits([]);
              }}
              className="underline hover:no-underline"
            >
              togli
            </button>
          </p>
        ) : (
          <>
            <input
              value={clientQ}
              onChange={(e) => setClientQ(e.target.value)}
              placeholder="Nome o telefono del cliente…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />

            {hits.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setClientId(h.id);
                        setPickedClient({ companyName: h.companyName, reused: true });
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span>
                        {h.companyName}
                        {h.phone ? <span className="text-muted-foreground"> · {h.phone}</span> : null}
                      </span>
                      {h.isLead ? (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-300">
                          prospect
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {clientQ.trim().length >= 2 && hits.length === 0 && !searching ? (
              <div className="space-y-2 rounded-md bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">
                  Nessun cliente trovato. Creane uno al volo: bastano nome e telefono.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome e cognome"
                    className="min-w-[10rem] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="Telefono"
                    className="w-40 rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={creating || newName.trim().length < 2 || newPhone.replace(/\D/g, "").length < 8}
                    onClick={async () => {
                      setCreating(true);
                      setClientErr(null);
                      const res = await createClientFromCounter(newName, newPhone);
                      setCreating(false);
                      if (!res.ok) {
                        setClientErr(res.error);
                        return;
                      }
                      setClientId(res.id);
                      setPickedClient({ companyName: res.companyName, reused: res.reused });
                    }}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {creating ? "Creo…" : "Crea cliente"}
                  </button>
                </div>
                {clientErr ? <p className="text-xs text-destructive">{clientErr}</p> : null}
              </div>
            ) : null}

            {!clientQ.trim() ? (
              <span className="text-xs text-muted-foreground">
                Lascia vuoto per registrare senza cliente. Non rallenta il banco.
              </span>
            ) : null}
          </>
        )}
      </div>

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
