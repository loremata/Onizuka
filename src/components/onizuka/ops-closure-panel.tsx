import { buildOpsClosureChecklist } from "@/lib/ops-readiness";

export function OpsClosurePanel() {
  const items = buildOpsClosureChecklist();
  const done = items.filter((i) => i.status === "done").length;
  const manual = items.filter((i) => i.status === "manual").length;

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {done} configurati in codice · {manual} azioni manuali una tantum
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-md border px-3 py-2 ${
              item.status === "done"
                ? "border-emerald-500/30 bg-emerald-500/5"
                : item.status === "manual"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{item.label}</span>
              <span className="text-[10px] uppercase text-muted-foreground">{item.status}</span>
            </div>
            {item.hint ? <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p> : null}
            {item.docPath ? (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.docPath}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
