import type { ReactNode } from "react";

/** Messaggio "vuoto" coerente (prima ripetuto inline come <p className="text-sm text-muted-foreground">). */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
