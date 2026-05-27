import { prisma } from "@/lib/prisma";
import { platformLabelIt } from "@/lib/post-ui-labels";
import type { Platform } from "@prisma/client";

export type EditorialCalendarItem = {
  id: string;
  clientId: string;
  clientName: string;
  platform: Platform;
  platformLabel: string;
  captionText: string;
  status: string;
  scheduledFor: Date | null;
  createdAt: Date;
};

export async function loadEditorialCalendar(params: {
  from: Date;
  to: Date;
  limit?: number;
}): Promise<EditorialCalendarItem[]> {
  const posts = await prisma.postItem.findMany({
    where: {
      OR: [
        { scheduledFor: { gte: params.from, lte: params.to } },
        {
          scheduledFor: null,
          createdAt: { gte: params.from, lte: params.to },
        },
      ],
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: params.limit ?? 200,
    include: { client: { select: { id: true, companyName: true } } },
  });

  return posts.map((p) => ({
    id: p.id,
    clientId: p.clientId,
    clientName: p.client.companyName,
    platform: p.platform,
    platformLabel: platformLabelIt[p.platform],
    captionText: p.captionText,
    status: p.status,
    scheduledFor: p.scheduledFor,
    createdAt: p.createdAt,
  }));
}
