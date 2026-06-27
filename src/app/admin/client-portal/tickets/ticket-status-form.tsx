"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TICKET_MAX_FILES } from "@/lib/ticket-upload";
import { updateTicketReply } from "./actions";
import { Select } from "@/components/ui/select";

const OPTIONS = [
  { value: "OPEN", label: "Aperto" },
  { value: "IN_PROGRESS", label: "In lavorazione" },
  { value: "RESOLVED", label: "Risolto" },
  { value: "CLOSED", label: "Chiuso" },
] as const;

export function TicketStatusForm({ ticketId, current }: { ticketId: string; current: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [nextStatus, setNextStatus] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (nextStatus === current && !message.trim() && !fileRef.current?.files?.length) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("status", nextStatus);
      if (message.trim()) fd.set("message", message.trim());
      const files = fileRef.current?.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          fd.append("attachments", files[i]);
        }
      }
      const result = await updateTicketReply(ticketId, fd);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setMessage("");
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-2">
      <Select
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        value={nextStatus}
        disabled={pending}
        onChange={(e) => setNextStatus(e.target.value)}
        aria-label="Stato ticket"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Nota al cliente (opz.)"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        disabled={pending}
      />
      <input
        ref={fileRef}
        type="file"
        name="attachments"
        multiple
        accept="image/*,application/pdf"
        disabled={pending}
        className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1"
        aria-label="Allegati risposta"
      />
      <p className="text-[10px] text-muted-foreground">Max {TICKET_MAX_FILES} file, 5 MB · immagini o PDF</p>
      <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" disabled={pending} onClick={submit}>
        {pending ? "…" : "Aggiorna"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
