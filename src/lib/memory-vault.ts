import { timingSafeEqual } from "crypto";
import { isMemoryEncryptionEnabled } from "@/lib/memory-crypto";

export type MemoryVaultStatus = {
  encryptionEnabled: boolean;
  vaultPinRequired: boolean;
  unmaskedExportAllowed: boolean;
};

export function isMemoryVaultPinConfigured(): boolean {
  return Boolean(process.env.ONIZUKA_MEMORY_VAULT_PIN?.trim());
}

export function getMemoryVaultStatus(): MemoryVaultStatus {
  return {
    encryptionEnabled: isMemoryEncryptionEnabled(),
    vaultPinRequired: isMemoryVaultPinConfigured(),
    unmaskedExportAllowed:
      process.env.ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT?.trim().toLowerCase() !== "0" &&
      process.env.ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT?.trim().toLowerCase() !== "false",
  };
}

/** Verifica PIN vault per export sensibili (timing-safe). */
export function verifyMemoryVaultPin(pin: string | null | undefined): boolean {
  const expected = process.env.ONIZUKA_MEMORY_VAULT_PIN?.trim();
  if (!expected) return true;
  const given = pin?.trim() ?? "";
  if (!given || given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
