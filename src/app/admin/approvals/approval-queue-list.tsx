import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import type { ApprovalQueueItem } from "@/lib/approval-queue";
import type { OutreachAbVariant } from "@/lib/outreach-ab";
import { EntityClientLabel } from "@/components/onizuka/client-link";
import { Button } from "@/components/ui/button";
import { ApprovalQueueOutreachActions } from "./approval-queue-row-actions";
import { ApprovalOutreachPreview } from "./approval-outreach-preview";

const kindMeta = {
  outreach_email: { label: "Email commerciali", hint: "Reach · approva prima dell'invio" },
  quote: { label: "Preventivi", hint: "Completa importi e invia al cliente" },
  post: { label: "Contenuti social", hint: "Approvazione prima della pubblicazione" },
} as const;

const kindOrder: ApprovalQueueItem["kind"][] = ["outreach_email", "quote", "post"];

type Props = {
  items: ApprovalQueueItem[];
  smtpConfigured: boolean;
  reachAbDefault?: OutreachAbVariant;
};

export function ApprovalQueueList({ items, smtpConfigured, reachAbDefault = "A" }: Props) {
  if (items.length === 0) return null;

  const byKind = kindOrder.map((kind) => ({
    kind,
    meta: kindMeta[kind],
    rows: items.filter((i) => i.kind === kind),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6">
      {byKind.map((group) => (
        <section key={group.kind}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {group.meta.label}
              <span className="ml-2 font-normal text-muted-foreground">({group.rows.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground">{group.meta.hint}</p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border/80 bg-card/50">
            {group.rows.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.status}
                  </p>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <EntityClientLabel
                      clientId={item.clientId}
                      clientName={item.clientName}
                      leadId={item.leadId}
                      leadName={item.leadName}
                      fallback="Senza cliente"
                    />
                    <span>·</span>
                    <span>
                      Aggiornato{" "}
                      {dateTimeFormatIt({
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(item.updatedAt)}
                    </span>
                  </p>
                  {item.kind === "outreach_email" ? (
                    <ApprovalOutreachPreview
                      draftId={item.id}
                      subject={item.title}
                      body={item.body ?? ""}
                      subjectAlt={item.subjectAlt}
                      bodyAlt={item.bodyAlt}
                      editable={item.status === "DRAFT" || item.status === "PENDING_APPROVAL"}
                    />
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  {item.kind === "outreach_email" ? (
                    <ApprovalQueueOutreachActions
                      draftId={item.id}
                      status={item.status}
                      smtpConfigured={smtpConfigured}
                      hasAb={item.outreachHasAb ?? false}
                      defaultAbVariant={reachAbDefault}
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {item.clientId ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/admin/clients/${item.clientId}`}>Scheda cliente</Link>
                      </Button>
                    ) : null}
                    {item.kind === "outreach_email" ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/reach?draft=${item.id}`}>Modifica</Link>
                      </Button>
                    ) : null}
                    <Button asChild size="sm">
                      <Link href={item.href}>Apri</Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
