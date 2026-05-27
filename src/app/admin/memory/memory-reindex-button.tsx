"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reindexAllMemoryEmbeddings } from "./actions";

export function MemoryReindexButton({ embeddingsEnabled }: { embeddingsEnabled: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!embeddingsEnabled) {
    return (
      <p className="text-xs text-muted-foreground">
        RAG semantico: imposta <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> (embeddings attivi).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const res = await reindexAllMemoryEmbeddings();
            if ("error" in res) setMessage(res.error);
            else
              setMessage(
                `Indicizzate ${res.indexed}/${res.processed} voci${res.skipped ? ` (${res.skipped} saltate)` : ""}.`
              );
          })
        }
      >
        {pending ? "Indicizzazione…" : "Indicizza embedding (batch)"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
