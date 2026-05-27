import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";

export type ActivityEntry = {
  id: string;
  at: Date;
  kind: "post" | "flow" | "opportunity" | "lead" | "comment";
  title: string;
  subtitle: string;
  href: string;
};

function mergeSort(entries: ActivityEntry[], limit: number): ActivityEntry[] {
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

export async function loadRecentActivity(
  ownerId: string,
  limit = 25
): Promise<{ ok: true; entries: ActivityEntry[] } | { ok: false; reason: "unavailable" }> {
  const result = await runWithDb(async () => {
    const [posts, tasks, opportunities, leads, comments] = await Promise.all([
      prisma.postItem.findMany({
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          updatedAt: true,
          status: true,
          platform: true,
          client: { select: { companyName: true } },
        },
      }),
      prisma.flowTask.findMany({
        where: { ownerUserId: ownerId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      prisma.opportunity.findMany({
        where: { ownerUserId: ownerId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          client: { select: { companyName: true } },
        },
      }),
      prisma.lead.findMany({
        where: { ownerUserId: ownerId },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      prisma.comment.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          body: true,
          createdAt: true,
          postItem: { select: { id: true, client: { select: { companyName: true } } } },
        },
      }),
    ]);

    const entries: ActivityEntry[] = [];

    for (const p of posts) {
      entries.push({
        id: `post-${p.id}`,
        at: p.updatedAt,
        kind: "post",
        title: `Post ${p.platform} · ${p.status}`,
        subtitle: p.client.companyName,
        href: `/admin/posts/${p.id}`,
      });
    }
    for (const t of tasks) {
      entries.push({
        id: `flow-${t.id}`,
        at: t.updatedAt,
        kind: "flow",
        title: t.title,
        subtitle: `Task · ${t.status}`,
        href: "/admin/flow",
      });
    }
    for (const o of opportunities) {
      entries.push({
        id: `opp-${o.id}`,
        at: o.updatedAt,
        kind: "opportunity",
        title: o.title,
        subtitle: `${o.status} · ${o.client?.companyName ?? "Prospect"}`,
        href: `/admin/crm/opportunities/${o.id}/edit`,
      });
    }
    for (const l of leads) {
      entries.push({
        id: `lead-${l.id}`,
        at: l.updatedAt,
        kind: "lead",
        title: l.title,
        subtitle: `Lead · ${l.status}`,
        href: `/admin/crm/leads/${l.id}/edit`,
      });
    }
    for (const c of comments) {
      const preview = c.body.trim().slice(0, 60) || "Commento";
      entries.push({
        id: `comment-${c.id}`,
        at: c.createdAt,
        kind: "comment",
        title: preview,
        subtitle: `Commento · ${c.postItem.client.companyName}`,
        href: `/admin/posts/${c.postItem.id}`,
      });
    }

    return mergeSort(entries, limit);
  });

  if (!result.ok) return { ok: false, reason: "unavailable" };
  return { ok: true, entries: result.data };
}
