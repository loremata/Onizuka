import Link from "next/link";
import { Button } from "@/components/ui/button";
import { currentMonth, shiftMonth } from "@/lib/inserimenti/dashboard";

/**
 * Navigatore mese del modulo: ← mese · nome mese · mese → (+ "Oggi" quando si
 * guarda un mese diverso dal corrente). Prima era copiato in 4 pagine con
 * piccole differenze; ora è uno solo. `children` finisce a destra (export CSV,
 * giorni rimanenti, ecc.).
 */
export function MonthNav({
  basePath,
  month,
  children,
}: {
  basePath: string;
  month: string;
  children?: React.ReactNode;
}) {
  const [yy, mm] = month.split("-").map(Number);
  const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const isCurrent = month === currentMonth();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild variant="outline" size="sm">
        <Link href={`${basePath}?mese=${shiftMonth(month, -1)}`}>← Mese precedente</Link>
      </Button>
      <span className="font-semibold capitalize">{monthLabel}</span>
      <Button asChild variant="outline" size="sm">
        <Link href={`${basePath}?mese=${shiftMonth(month, 1)}`}>Mese successivo →</Link>
      </Button>
      {!isCurrent ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={basePath}>Oggi</Link>
        </Button>
      ) : null}
      {children ? <span className="ml-auto flex items-center gap-3">{children}</span> : null}
    </div>
  );
}
