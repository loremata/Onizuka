import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DbUnavailableBanner() {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Database non raggiungibile</CardTitle>
        <CardDescription>
          PostgreSQL su <code className="rounded bg-muted px-1 text-xs">127.0.0.1:5433</code> non risponde. Le pagine
          admin richiedono il database locale.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Avvia <strong className="text-foreground">Docker Desktop</strong> e attendi che sia pronto.</li>
          <li>
            Nel terminale:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:sync</code>
          </li>
          <li>Ricarica questa pagina.</li>
        </ol>
        <p className="text-xs">
          Solo sviluppo locale. In alternativa: <code className="rounded bg-muted px-1 text-xs">npm run db:up</code> poi{" "}
          <code className="rounded bg-muted px-1 text-xs">npm run db:seed</code>.
        </p>
      </CardContent>
    </Card>
  );
}
