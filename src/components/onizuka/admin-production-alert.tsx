import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildDeployStatusReport } from "@/lib/deploy-status";
import { findAccountsWithDefaultSeedPasswords } from "@/lib/seed-password-check";

export async function AdminProductionAlert() {
  const [report, weakEmails] = await Promise.all([
    Promise.resolve(buildDeployStatusReport()),
    findAccountsWithDefaultSeedPasswords(),
  ]);

  const showDeploy = !report.productionReady;
  const showSeed = weakEmails.length > 0;
  if (!showDeploy && !showSeed) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pronto per il go-live?</CardTitle>
        <CardDescription>
          {showDeploy && showSeed
            ? "Risolvi i blocchi deploy e cambia le password demo."
            : showDeploy
              ? "Ci sono blocchi nella configurazione di produzione."
              : "Account demo con password predefinite ancora attivi."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {showDeploy && report.issues.length > 0 ? (
          <ul className="list-inside list-disc text-muted-foreground">
            {report.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : null}
        {showSeed ? (
          <p className="text-muted-foreground">
            Password seed su:{" "}
            <span className="font-mono text-foreground">{weakEmails.join(", ")}</span>
          </p>
        ) : null}
        <Button asChild size="sm" variant="secondary">
          <Link href="/admin/go-live">Apri hub go-live</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
