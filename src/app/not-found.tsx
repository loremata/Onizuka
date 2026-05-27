import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Pagina non trovata</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        L&apos;indirizzo potrebbe essere errato o la risorsa è stata spostata. Se hai effettuato l&apos;accesso, torna
        all&apos;area riservata.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="default">
          <Link href="/">Vai alla home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Accedi</Link>
        </Button>
      </div>
    </div>
  );
}
