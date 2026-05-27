import { prisma } from "@/lib/prisma";

export async function saveNotifyDigestEmailPreference(userId: string, enabled: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { notifyDigestEmail: enabled },
  });
}
