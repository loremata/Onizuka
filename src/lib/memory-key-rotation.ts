import { prisma } from "@/lib/prisma";
import {
  encryptMemoryContent,
  isMemoryEncryptionEnabled,
  isMemoryKeyRotationConfigured,
  readMemoryContentPlain,
} from "@/lib/memory-crypto";

export { isMemoryKeyRotationConfigured };

/** Ri-cifra tutte le voci HIGH cifrate dell'owner con la chiave corrente. */
export async function reencryptOwnerMemoryVault(
  ownerUserId: string
): Promise<
  | { ok: true; processed: number; reencrypted: number; skipped: number }
  | { ok: false; error: string }
> {
  if (!isMemoryEncryptionEnabled()) {
    return { ok: false, error: "ONIZUKA_MEMORY_ENCRYPTION_KEY non configurata." };
  }

  const rows = await prisma.memoryItem.findMany({
    where: { ownerUserId, contentEncrypted: true },
    select: { id: true, content: true, contentEncrypted: true, sensitivity: true },
  });

  let reencrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    const plain = readMemoryContentPlain(row.content, row.contentEncrypted);
    if (plain.startsWith("[contenuto cifrato")) {
      skipped += 1;
      continue;
    }

    const stored = encryptMemoryContent(plain);
    await prisma.memoryItem.update({
      where: { id: row.id },
      data: {
        content: stored.content,
        contentEncrypted: stored.contentEncrypted,
      },
    });
    reencrypted += 1;
  }

  return { ok: true, processed: rows.length, reencrypted, skipped };
}
