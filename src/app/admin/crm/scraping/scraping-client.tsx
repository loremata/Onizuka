"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Provincia = { nome: string; sigla: string; regione: string };
type Comune = { nome: string; slug: string };

type Job = {
  id: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "ERROR";
  phase: string | null;
  progressCurrent: number;
  progressTotal: number;
  totalFound: number;
  activeCount: number;
  excludedCount: number;
  placesEnriched: number;
  leadsCreated: number;
  dedupSkipped: number;
  error: string | null;
};

const PHASE_LABEL: Record<string, string> = {
  "registro:lista": "Elenco registro",
  registro: "Schede registro",
  places: "Arricchimento Google",
  merge: "Deduplicazione",
  import: "Creazione Lead",
};

export function ScrapingClient({ province }: { province: Provincia[] }) {
  const [provincia, setProvincia] = useState("");
  const [comuni, setComuni] = useState<Comune[]>([]);
  const [comune, setComune] = useState("");
  const [loadingComuni, setLoadingComuni] = useState(false);
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [errore, setErrore] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carica i comuni quando cambia la provincia.
  useEffect(() => {
    setComune("");
    setComuni([]);
    if (!provincia) return;
    setLoadingComuni(true);
    fetch(`/api/admin/crm/scraping/comuni?provincia=${encodeURIComponent(provincia)}`)
      .then((r) => r.json())
      .then((d) => setComuni(d.comuni ?? []))
      .catch(() => setComuni([]))
      .finally(() => setLoadingComuni(false));
  }, [provincia]);

  const pollStatus = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/admin/crm/scraping/status?jobId=${jobId}`);
        const d = await r.json();
        if (d.job) {
          setJob(d.job);
          if (d.job.status === "DONE" || d.job.status === "ERROR") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        /* riprova al prossimo tick */
      }
    }, 3000);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function avvia() {
    setErrore("");
    setStarting(true);
    setJob(null);
    try {
      const r = await fetch("/api/admin/crm/scraping/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provincia, comune }),
      });
      const d = await r.json();
      if (!r.ok) { setErrore(d.error || "Errore nell'avvio."); return; }
      pollStatus(d.jobId);
    } catch {
      setErrore("Errore di rete.");
    } finally {
      setStarting(false);
    }
  }

  const inCorso = job && (job.status === "QUEUED" || job.status === "RUNNING");
  const pct =
    job && job.progressTotal > 0
      ? Math.min(100, Math.round((job.progressCurrent / job.progressTotal) * 100))
      : 0;

  const selectClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Provincia</label>
          <select className={selectClass} value={provincia} onChange={(e) => setProvincia(e.target.value)}>
            <option value="">— seleziona —</option>
            {province.map((p) => (
              <option key={p.nome} value={p.nome}>{p.nome} ({p.sigla}) — {p.regione}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Comune</label>
          <select
            className={selectClass}
            value={comune}
            onChange={(e) => setComune(e.target.value)}
            disabled={!provincia || loadingComuni}
          >
            <option value="">{loadingComuni ? "caricamento…" : "— seleziona —"}</option>
            {comuni.map((c) => (
              <option key={c.slug} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={avvia} disabled={!provincia || !comune || starting || Boolean(inCorso)}>
          {starting ? "Avvio…" : inCorso ? "In corso…" : "Avvia scraping"}
        </Button>
        {comune && <span className="text-sm text-muted-foreground">{comune} ({provincia})</span>}
      </div>

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {job && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Stato: {job.status === "DONE" ? "✅ Completato" : job.status === "ERROR" ? "❌ Errore" : job.status === "QUEUED" ? "In coda (attende il worker)" : "In esecuzione"}
            </span>
            {job.phase && inCorso && (
              <span className="text-muted-foreground">
                {PHASE_LABEL[job.phase] ?? job.phase}
                {job.progressTotal > 0 ? ` — ${job.progressCurrent}/${job.progressTotal}` : ""}
              </span>
            )}
          </div>

          {inCorso && (
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}

          {job.status === "QUEUED" && (
            <p className="text-xs text-amber-600">
              Il job è in coda. Se non parte, verifica che il <strong>worker sul PC</strong> sia avviato.
            </p>
          )}

          {(job.status === "DONE" || job.status === "RUNNING") && (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <Stat label="Trovate (registro)" value={job.totalFound} />
              <Stat label="Attive" value={job.activeCount} />
              <Stat label="Escluse (cessate/liq.)" value={job.excludedCount} />
              <Stat label="Arricchite Google" value={job.placesEnriched} />
              <Stat label="Lead creati" value={job.leadsCreated} highlight />
              <Stat label="Già presenti (saltate)" value={job.dedupSkipped} />
            </div>
          )}

          {job.status === "ERROR" && job.error && (
            <p className="text-sm text-red-600">{job.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded border p-2 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
