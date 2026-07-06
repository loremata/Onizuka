import { dateTimeFormatIt } from "@/lib/datetime-it";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { digitalAuditSectionLabel } from "@/lib/digital-audit-labels";
import type { AuditMetrics } from "@/lib/audit/scoring";

type ScoreTone = { bar: string; text: string; soft: string; label: string };

function tone(score: number): ScoreTone {
  if (score >= 80) return { bar: "#16a34a", text: "#166534", soft: "#dcfce7", label: "Ottimo" };
  if (score >= 65) return { bar: "#22c55e", text: "#15803d", soft: "#dcfce7", label: "Buono" };
  if (score >= 45) return { bar: "#d97706", text: "#92400e", soft: "#fef3c7", label: "Migliorabile" };
  if (score >= 30) return { bar: "#ea580c", text: "#9a3412", soft: "#ffedd5", label: "Debole" };
  return { bar: "#dc2626", text: "#991b1b", soft: "#fee2e2", label: "Critico" };
}

function parseMetrics(json: string | null): AuditMetrics | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AuditMetrics;
  } catch {
    return null;
  }
}

function ScoreDonut({ score }: { score: number }) {
  const t = tone(score);
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={t.bar}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
      />
      <text x="60" y="54" transform="rotate(90 60 60)" textAnchor="middle" fontSize="30" fontWeight="700" fill={t.text}>
        {score}
      </text>
      <text x="60" y="74" transform="rotate(90 60 60)" textAnchor="middle" fontSize="11" fill="#6b7280">
        / 100
      </text>
    </svg>
  );
}

function PsiBadge({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const t = tone(value);
  return (
    <div className="flex flex-col items-center rounded-lg border px-3 py-2" style={{ background: t.soft }}>
      <span className="text-2xl font-bold tabular-nums" style={{ color: t.text }}>
        {value}
      </span>
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
    </div>
  );
}

function cwvRating(kind: "lcp" | "cls" | "tbt", v: number): ScoreTone {
  const good = kind === "lcp" ? v <= 2500 : kind === "cls" ? v <= 0.1 : v <= 200;
  const poor = kind === "lcp" ? v > 4000 : kind === "cls" ? v > 0.25 : v > 600;
  if (good) return tone(85);
  if (poor) return tone(35);
  return tone(55);
}

export default async function PublicAuditReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const audit = await prisma.digitalAudit.findFirst({
    where: { publicReportToken: token },
    include: {
      sections: { orderBy: { score: "asc" } },
      recommendedBrand: { select: { name: true } },
      recommendedService: { select: { name: true } },
    },
  });

  if (!audit) notFound();
  if (audit.publicReportExpiresAt && audit.publicReportExpiresAt < new Date()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Report scaduto</h1>
        <p className="mt-2 text-gray-500">Richiedi un nuovo link al referente Online Station.</p>
      </main>
    );
  }

  const dateFmt = dateTimeFormatIt({ dateStyle: "long" });
  const metrics = parseMetrics(audit.metricsJson);
  const psi = metrics?.pagespeed ?? null;
  const overall = audit.overallScore ?? 0;
  const overallTone = tone(overall);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        {/* Header + gauge */}
        <header className="flex flex-col items-center gap-4 rounded-2xl border bg-white p-8 text-center shadow-sm sm:flex-row sm:text-left">
          <ScoreDonut score={overall} />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Analisi della presenza digitale
            </p>
            <h1 className="mt-1 text-2xl font-bold">{audit.businessName ?? "La vostra azienda"}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {audit.website ? `${audit.website} · ` : ""}
              {dateFmt.format(audit.createdAt)}
            </p>
            <span
              className="mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: overallTone.soft, color: overallTone.text }}
            >
              Valutazione complessiva: {overallTone.label}
            </span>
          </div>
        </header>

        {/* Giudizio di Google (PageSpeed) */}
        {psi && (psi.performance != null || psi.seo != null) ? (
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold">Il giudizio di Google sul vostro sito</h2>
            <p className="mt-1 text-sm text-gray-500">
              Punteggi ufficiali Google PageSpeed (versione mobile){psi.fromField ? ", con dati di utenti reali" : ""}.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PsiBadge label="Performance" value={psi.performance} />
              <PsiBadge label="SEO tecnica" value={psi.seo} />
              <PsiBadge label="Accessibilità" value={psi.accessibility} />
              <PsiBadge label="Best practices" value={psi.bestPractices} />
            </div>
            {(psi.lcpMs != null || psi.cls != null || psi.tbtMs != null) && (
              <div className="mt-4 flex flex-wrap gap-4 border-t pt-4 text-sm">
                {psi.lcpMs != null && (
                  <span>
                    Caricamento (LCP):{" "}
                    <b style={{ color: cwvRating("lcp", psi.lcpMs).text }}>{(psi.lcpMs / 1000).toFixed(1)}s</b>
                  </span>
                )}
                {psi.cls != null && (
                  <span>
                    Stabilità (CLS):{" "}
                    <b style={{ color: cwvRating("cls", psi.cls).text }}>{psi.cls.toFixed(2)}</b>
                  </span>
                )}
                {psi.tbtMs != null && (
                  <span>
                    Reattività (TBT):{" "}
                    <b style={{ color: cwvRating("tbt", psi.tbtMs).text }}>{psi.tbtMs} ms</b>
                  </span>
                )}
              </div>
            )}
          </section>
        ) : null}

        {/* Opportunità prioritaria */}
        {audit.priorityProblem ? (
          <section className="rounded-2xl border-l-4 bg-white p-6 shadow-sm" style={{ borderColor: overallTone.bar }}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Opportunità prioritaria</h2>
            <p className="mt-2 text-lg font-semibold">{audit.priorityProblem}</p>
            {(audit.recommendedBrand || audit.recommendedService) && (
              <p className="mt-2 text-sm text-gray-600">
                Intervento consigliato:{" "}
                <b>{[audit.recommendedBrand?.name, audit.recommendedService?.name].filter(Boolean).join(" — ")}</b>
              </p>
            )}
          </section>
        ) : null}

        {/* Analisi per area */}
        <section className="space-y-3">
          <h2 className="px-1 text-base font-bold">Analisi area per area</h2>
          {audit.sections.map((s) => {
            const t = tone(s.score);
            return (
              <div key={s.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{digitalAuditSectionLabel[s.sectionKey]}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: t.text }}>
                    {s.score}/100 · {t.label}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: t.bar }} />
                </div>
                {s.positives ? (
                  <p className="mt-3 text-sm text-gray-700">
                    <span className="font-semibold text-green-700">Punti di forza. </span>
                    {s.positives}
                  </p>
                ) : null}
                {s.issues ? (
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-semibold" style={{ color: "#b45309" }}>
                      Da migliorare.{" "}
                    </span>
                    {s.issues}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>

        {/* CTA */}
        <section className="rounded-2xl border bg-gray-900 p-8 text-center text-white">
          <h2 className="text-lg font-bold">Trasformiamo questi punti in clienti in più</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-300">
            Ogni area qui sopra è un’opportunità concreta. In una consulenza gratuita vi mostriamo le priorità e i
            risultati ottenibili, dati alla mano. Rispondete a questa email o contattate Online Station.
          </p>
        </section>

        <p className="text-center text-xs text-gray-400">
          Analisi basata su dati pubblici del sito, Google PageSpeed e Google Business Profile ·{" "}
          {dateFmt.format(audit.createdAt)} · Online Station
        </p>
      </div>
    </main>
  );
}
