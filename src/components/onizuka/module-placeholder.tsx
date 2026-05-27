import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  summary: string;
  bullets?: string[];
};

export function ModulePlaceholder({ title, summary, bullets = [] }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{summary}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Roadmap Onizuka</CardTitle>
          <CardDescription>Modulo in costruzione secondo la specifica master.</CardDescription>
        </CardHeader>
        <CardContent>
          {bullets.length > 0 ? (
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Dettagli in arrivo nelle prossime iterazioni.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
