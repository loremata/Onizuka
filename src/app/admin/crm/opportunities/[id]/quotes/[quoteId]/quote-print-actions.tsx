"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function QuotePrintActions({ quoteId }: { quoteId: string }) {
  return (
    <>
      <Button asChild type="button" size="sm" variant="outline">
        <Link href={`/api/admin/quotes/${quoteId}/pdf`} prefetch={false}>
          Scarica PDF
        </Link>
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => window.print()}>
        Stampa
      </Button>
    </>
  );
}
