import type { ReactNode } from "react";

type Props = {
  title: string;
  lead?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({ title, lead, actions }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="onizuka-page-title">{title}</h1>
        {lead ? <p className="onizuka-page-lead max-w-2xl">{lead}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
