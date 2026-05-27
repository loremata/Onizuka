import { isAdminReplyUnread } from "@/lib/ticket-unread";

export type TicketUpdateRow = {
  id: string;
  message: string | null;
  status: string | null;
  createdAt: Date;
  createdByUserId: string | null;
  clientReadAt: Date | null;
  attachments: { id: string; filename: string; url: string }[];
};

const statusLabel: Record<string, string> = {
  OPEN: "Aperto",
  IN_PROGRESS: "In lavorazione",
  RESOLVED: "Risolto",
  CLOSED: "Chiuso",
};

export function TicketUpdateList({
  updates,
  dateFmt,
  showReadReceipts = false,
}: {
  updates: TicketUpdateRow[];
  dateFmt: Intl.DateTimeFormat;
  showReadReceipts?: boolean;
}) {
  if (updates.length === 0) return null;

  return (
    <ul className="mt-2 space-y-2 border-t border-border/40 pt-2 text-xs">
      {updates.map((u) => {
        const unread = isAdminReplyUnread(u);
        return (
          <li key={u.id} className="rounded border border-border/40 bg-muted/20 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{dateFmt.format(u.createdAt)}</span>
              {u.status ? (
                <span className="rounded bg-muted px-1 text-[10px]">{statusLabel[u.status] ?? u.status}</span>
              ) : null}
              {unread ? (
                <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-700 dark:text-amber-400">
                  Nuovo
                </span>
              ) : null}
              {showReadReceipts && u.createdByUserId ? (
                <span className="text-[10px] text-muted-foreground">
                  {u.clientReadAt ? `Letto ${dateFmt.format(u.clientReadAt)}` : "Non letto dal cliente"}
                </span>
              ) : null}
            </div>
            {u.message ? <p className="mt-1 whitespace-pre-wrap text-foreground">{u.message}</p> : null}
            {u.attachments.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {u.attachments.map((a) => (
                  <li key={a.id}>
                    <a className="text-primary hover:underline" href={a.url} target="_blank" rel="noreferrer">
                      {a.filename}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
