"use client";

import { useEffect, useState } from "react";

export function TimeErpPullStatus() {
  const [status, setStatus] = useState<{ configured: boolean; ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/time/erp-pull")
      .then(async (r) => r.json())
      .then((d) => setStatus(d as { configured: boolean; ok: boolean; message: string }))
      .catch(() => setStatus({ configured: false, ok: false, message: "Probe non disponibile." }));
  }, []);

  if (!status) return null;
  if (!status.configured) {
    return (
      <p className="text-xs text-muted-foreground">
        Pull ERP bidirezionale: imposta <span className="font-mono">TIME_ERP_PULL_URL</span> (+ secret opz.).
      </p>
    );
  }

  return (
    <p className={`text-xs ${status.ok ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
      ERP pull: {status.message}
    </p>
  );
}
