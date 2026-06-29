import { prisma } from "@/lib/prisma";
import { lifecycleForRelationshipState } from "@/lib/client-lifecycle";

/**
 * Promuove a CLIENTE un prospect (LEAD) o un ex-cliente quando acquisisce un
 * servizio/contratto ricorrente attivo. Collega la macchina-stati agli eventi
 * commerciali ricorrenti (retail/digitale), non solo a WON/LOST delle opportunità.
 * No-op se il record è già CLIENTE. Ritorna true se ha promosso.
 */
export async function promoteClientToClienteIfNeeded(clientId: string): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { status: true, relationshipState: true },
  });
  if (!client || client.relationshipState === "CLIENTE") return false;
  const lc = lifecycleForRelationshipState("CLIENTE", client.status);
  await prisma.client.update({
    where: { id: clientId },
    data: { relationshipState: lc.relationshipState, status: lc.status },
  });
  return true;
}
