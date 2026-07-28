import { prisma } from "@/lib/prisma";
import { resolveAutoConsentBasis, type MarketingPolicy } from "@/lib/marketing-consent-policy";

/**
 * Applica la politica di classificazione ai contatti già a sistema che non hanno
 * ancora una base giuridica. Serve a rendere l'impostazione immediatamente
 * efficace invece di valere solo per i contatti futuri.
 *
 * Non tocca mai: chi si è disiscritto, i clienti veri (hanno SOFT_OPT_IN, base
 * più solida) e chi una base ce l'ha già. Non declassa nessuno: restringere la
 * politica vale sui contatti nuovi, per togliere una base già assegnata serve un
 * intervento esplicito.
 */
export async function applyMarketingPolicyToExistingContacts(
  policy: MarketingPolicy
): Promise<number> {
  if (policy.marketingAutoBasis === "NONE") return 0;

  const candidates = await prisma.client.findMany({
    where: {
      marketingConsentBasis: "NONE",
      marketingOptOutAt: null,
      relationshipState: { not: "CLIENTE" },
    },
    select: { id: true, contactEmail: true },
  });

  const toUpdate = candidates.filter(
    (c) => resolveAutoConsentBasis(c.contactEmail, policy) !== "NONE"
  );
  if (!toUpdate.length) return 0;

  const res = await prisma.client.updateMany({
    where: { id: { in: toUpdate.map((c) => c.id) } },
    data: { marketingConsentBasis: policy.marketingAutoBasis },
  });
  return res.count;
}
