import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SchemaSetupBanner() {
  return (
    <Card className="border-amber-500/40 bg-amber-500/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Schema database incompleto</CardTitle>
        <CardDescription>
          La tabella Asset (e forse altre) non è presente. Applica le migrazioni Prisma e il seed demo.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>
          Nel terminale, dalla cartella del progetto:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:sync</code>
        </p>
        <p className="mt-2">
          Oppure: <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:up</code> poi{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:deploy</code> e{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:seed</code>.
        </p>
      </CardContent>
    </Card>
  );
}
