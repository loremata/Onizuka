"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateQuoteStatus } from "../actions";
import type { QuoteStatus } from "@prisma/client";

export function QuoteStatusActions({ quoteId, current }: { quoteId: string; current: QuoteStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setStatus(status: QuoteStatus) {
    start(async () => {
      await updateQuoteStatus(quoteId, status);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {current === "DRAFT" ? (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("SENT")}>
          Segna inviato
        </Button>
      ) : null}
      {current === "SENT" ? (
        <>
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setStatus("ACCEPTED")}>
            Accettato
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setStatus("REJECTED")}>
            Rifiutato
          </Button>
        </>
      ) : null}
    </div>
  );
}
