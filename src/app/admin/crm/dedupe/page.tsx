import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { findClientDuplicateGroups } from "@/lib/client-dedupe";
import { maxDuplicateScoreInGroup } from "@/lib/dedupe-group-score";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DedupeMergeForm } from "./dedupe-merge-form";
import { DedupeScanPanel } from "./dedupe-scan-panel";
import { DedupeAlertSettings } from "./dedupe-alert-settings";
import { DedupeEmbeddingPanel } from "./dedupe-embedding-panel";
import { DedupeTrainingPanel } from "./dedupe-training-panel";
import { DedupeGpuJobsPanel } from "./dedupe-gpu-jobs-panel";
import { getDedupeModelConfig } from "@/lib/client-dedupe-training";
import { listRecentDedupeTrainingJobs } from "@/lib/dedupe-training-gpu";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ClientDedupePage({ searchParams }: Props) {
  const session = await requireFullAdmin();
  const fullFuzzy = firstParam(searchParams.fullFuzzy) === "1";
  const deepFuzzy = firstParam(searchParams.deepFuzzy) === "1";
  const fuzzyIndexedClients = fullFuzzy ? 10000 : deepFuzzy ? 6000 : 1200;
  const groups = await findClientDuplicateGroups({ fuzzyIndexedClients });
  const [latestScan, me, dedupeModel, gpuJobs] = await Promise.all([
    prisma.dedupeScanRun.findFirst({
      where: { ownerUserId: session.user.id },
      orderBy: { startedAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dedupeAlertMinGroups: true },
    }),
    getDedupeModelConfig(),
    listRecentDedupeTrainingJobs(8),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dedupe & merge clienti</h1>
        <p className="text-muted-foreground">
          Gruppi con stessa P.IVA, stessa email o ragione sociale normalizzata simile. Unisci i duplicati per
          mantenere anagrafica unica. Il fuzzy nome indicizza fino a <strong>{fuzzyIndexedClients}</strong> anagrafiche
          (costo CPU). <code className="text-xs">?deepFuzzy=1</code> → 6000; <code className="text-xs">?fullFuzzy=1</code>{" "}
          → 10000 (solo se necessario).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild variant={!deepFuzzy && !fullFuzzy ? "secondary" : "outline"} size="sm">
            <Link href="/admin/crm/dedupe">Fuzzy standard (1200)</Link>
          </Button>
          <Button asChild variant={deepFuzzy && !fullFuzzy ? "secondary" : "outline"} size="sm">
            <Link href="/admin/crm/dedupe?deepFuzzy=1">Fuzzy esteso (6000)</Link>
          </Button>
          <Button asChild variant={fullFuzzy ? "secondary" : "outline"} size="sm">
            <Link href="/admin/crm/dedupe?fullFuzzy=1">Fuzzy massimo (10000)</Link>
          </Button>
        </div>
      </div>

      <DedupeAlertSettings initialMinGroups={me?.dedupeAlertMinGroups ?? null} />

      <DedupeEmbeddingPanel />

      <DedupeTrainingPanel modelVersion={dedupeModel.version} />

      <DedupeGpuJobsPanel
        jobs={gpuJobs.map((j) => ({
          id: j.id,
          status: j.status,
          pairsCount: j.pairsCount,
          datasetUrl: j.datasetUrl,
          weightsVersion: j.weightsVersion,
          createdAt: j.createdAt.toISOString(),
          completedAt: j.completedAt?.toISOString() ?? null,
        }))}
      />

      <DedupeScanPanel
        initialRun={
          latestScan
            ? {
                ...latestScan,
                startedAt: latestScan.startedAt.toISOString(),
                completedAt: latestScan.completedAt?.toISOString() ?? null,
              }
            : null
        }
      />

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nessun duplicato rilevato sulle regole P.IVA / email / nome.
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => {
          const groupScore = maxDuplicateScoreInGroup(g.clients);
          return (
          <Card key={g.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {g.reason === "vat"
                  ? "Stessa Partita IVA"
                  : g.reason === "email"
                    ? "Stessa email"
                    : g.reason === "name"
                      ? "Ragione sociale (normalizzata)"
                      : "Ragione sociale · fuzzy (Levenshtein ≤ 1)"}{" "}
                ({g.clients.length})
                {groupScore > 0 ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · score max {groupScore}%
                  </span>
                ) : null}
              </CardTitle>
              <CardDescription>
                {g.reason === "vat"
                  ? g.clients[0]?.vatNumber
                  : g.reason === "email"
                    ? g.clients[0]?.contactEmail
                    : g.reason === "name"
                      ? g.key.replace(/^name:/, "")
                      : g.clients.map((c) => c.companyName).join(" · ")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {g.clients.map((c) => (
                  <li key={c.id}>
                    <Link className="text-primary hover:underline" href={`/admin/clients/${c.id}`}>
                      {c.companyName}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {c.contactEmail}
                      {c.vatNumber ? ` · ${c.vatNumber}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <DedupeMergeForm clients={g.clients} />
            </CardContent>
          </Card>
        );
        })
      )}

      <Button asChild variant="outline" size="sm">
        <Link href="/admin/clients">← Clienti</Link>
      </Button>
    </div>
  );
}
