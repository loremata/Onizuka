import { getErpPartnerStatus, type ErpPartnerBadge } from "@/lib/erp-partner-cert";

const badgeClass: Record<ErpPartnerBadge, string> = {
  certified: "bg-green-500/15 text-green-800 dark:text-green-300",
  connected: "bg-blue-500/15 text-blue-800 dark:text-blue-300",
  configured: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  off: "bg-muted text-muted-foreground",
};

export async function ErpPartnerBadges() {
  const status = await getErpPartnerStatus();

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {(["zucchetti", "sap"] as const).map((key) => {
        const row = status[key];
        return (
          <div
            key={key}
            className={`rounded-md px-3 py-2 ${badgeClass[row.badge]}`}
            title={row.message}
          >
            <span className="font-medium capitalize">{key}</span>
            <span className="ml-2 text-xs uppercase">{row.badge}</span>
          </div>
        );
      })}
    </div>
  );
}
