import { getMemoryVaultStatus } from "@/lib/memory-vault";
import { isMemoryKeyRotationConfigured } from "@/lib/memory-crypto";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MemoryVaultActions } from "@/app/admin/memory/memory-vault-actions";

export function MemoryVaultBanner({ encryptedCount }: { encryptedCount: number }) {
  const status = getMemoryVaultStatus();
  const keyRotationReady = isMemoryKeyRotationConfigured();

  return (
    <Card className="max-w-3xl border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Vault memoria enterprise</CardTitle>
        <CardDescription>
          Cifratura AES-256-GCM per sensibilità HIGH · export policy con conferma e PIN opzionale.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <ul className="list-inside list-disc text-muted-foreground">
          <li>
            Cifratura at-rest:{" "}
            <span className={status.encryptionEnabled ? "text-green-600" : "text-amber-600"}>
              {status.encryptionEnabled ? "attiva" : "non configurata (ONIZUKA_MEMORY_ENCRYPTION_KEY)"}
            </span>
          </li>
          <li>
            Voci cifrate in elenco: <span className="font-medium text-foreground">{encryptedCount}</span>
          </li>
          <li>
            PIN export sensibili:{" "}
            {status.vaultPinRequired ? "richiesto (ONIZUKA_MEMORY_VAULT_PIN)" : "non impostato"}
          </li>
          <li>
            Export senza maschera:{" "}
            {status.unmaskedExportAllowed ? "consentito con confirm=1" : "disabilitato in env"}
          </li>
          <li>
            Rotazione chiavi:{" "}
            {keyRotationReady
              ? "ONIZUKA_MEMORY_ENCRYPTION_KEY_PREVIOUS attiva"
              : "imposta chiave precedente per decrypt legacy"}
          </li>
        </ul>
        <MemoryVaultActions
          showReencrypt={status.encryptionEnabled && encryptedCount > 0}
        />
      </CardContent>
    </Card>
  );
}
