import { prisma } from "@/lib/prisma";

export const DEFAULT_ONBOARDING_LABELS = [
  "Contratto / ordine confermato",
  "Brief e materiali raccolti",
  "Accessi (social, analytics, sito)",
  "Kickoff call completata",
  "Piano operativo approvato dal cliente",
] as const;

export async function ensureDefaultOnboardingItems(
  clientId: string,
  ownerUserId: string
): Promise<void> {
  const count = await prisma.clientOnboardingItem.count({ where: { clientId } });
  if (count > 0) return;

  await prisma.clientOnboardingItem.createMany({
    data: DEFAULT_ONBOARDING_LABELS.map((label, i) => ({
      clientId,
      ownerUserId,
      label,
      sortOrder: i,
      status: "pending",
    })),
  });
}
