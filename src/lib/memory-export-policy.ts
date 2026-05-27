import { parseMaskSensitiveParam } from "@/lib/memory-export";
import { isMemoryVaultPinConfigured, verifyMemoryVaultPin } from "@/lib/memory-vault";

/** Kill-switch: imposta ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT=0 in produzione se serve. */
export function isUnmaskedMemoryExportAllowed(): boolean {
  const v = process.env.ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  return true;
}

export type MemoryExportGate =
  | { allowed: true; maskSensitive: boolean }
  | { allowed: false; status: number; error: string };

export function gateMemoryExport(searchParams: URLSearchParams): MemoryExportGate {
  const maskSensitive = parseMaskSensitiveParam(searchParams.get("maskSensitive"));
  if (maskSensitive) return { allowed: true, maskSensitive: true };

  if (!isUnmaskedMemoryExportAllowed()) {
    return {
      allowed: false,
      status: 403,
      error: "Export senza maschera disabilitato (ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT).",
    };
  }
  if (searchParams.get("confirm") !== "1") {
    return {
      allowed: false,
      status: 400,
      error: "Conferma richiesta: aggiungi confirm=1 per esportare contenuti sensibili.",
    };
  }
  if (isMemoryVaultPinConfigured() && !verifyMemoryVaultPin(searchParams.get("vaultPin"))) {
    return {
      allowed: false,
      status: 403,
      error: "PIN vault non valido (parametro vaultPin).",
    };
  }
  return { allowed: true, maskSensitive: false };
}
