"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Mostra un toast di conferma/errore in base ai parametri ?ok= / ?err= e li ripulisce
 * dall'URL. Le server action che fanno redirect aggiungono ?ok=Messaggio per dare
 * finalmente un feedback "Salvato" (prima i redirect erano silenziosi).
 */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ok = params.get("ok");
  const err = params.get("err");

  useEffect(() => {
    if (!ok && !err) return;
    if (ok) toast.success(ok);
    if (err) toast.error(err);
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.delete("ok");
    sp.delete("err");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, err]);

  return null;
}
