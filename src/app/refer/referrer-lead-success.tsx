"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Dopo invio lead, ricarica la pagina server per aggiornare lista e statistiche. */
export function ReferrerLeadSuccessPanel({ referrerName }: { referrerName: string }) {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="rounded-md border border-green-600/40 bg-green-600/10 p-4 text-sm text-green-800 dark:text-green-200">
      Grazie. La segnalazione è stata inviata a <strong>{referrerName}</strong> (agenzia). Ti contatteranno se serve
      altro.
    </div>
  );
}
