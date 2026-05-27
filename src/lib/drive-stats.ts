import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";

export type DriveClientRow = {
  id: string;
  companyName: string;
  slug: string;
  postCount: number;
  assetCount: number;
  memoryCount: number;
  ticketCount: number;
};

export type DriveClientFolder = {
  client: {
    id: string;
    companyName: string;
    slug: string;
    contactEmail: string;
    driveFolderUrl: string | null;
  };
  posts: { id: string; captionText: string; status: string; updatedAt: Date }[];
  assets: { id: string; name: string; platform: string | null; updatedAt: Date }[];
  memoryItems: { id: string; title: string; scope: string; updatedAt: Date }[];
  tickets: { id: string; title: string; status: string; updatedAt: Date }[];
};

export async function loadDriveOverview(): Promise<
  { ok: true; clients: DriveClientRow[] } | { ok: false; reason: "unavailable" }
> {
  const result = await runWithDb(() =>
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: {
        id: true,
        companyName: true,
        slug: true,
        _count: { select: { posts: true, assets: true, memoryItems: true, tickets: true } },
      },
    })
  );

  if (!result.ok) return { ok: false, reason: "unavailable" };

  return {
    ok: true,
    clients: result.data.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      slug: c.slug,
      postCount: c._count.posts,
      assetCount: c._count.assets,
      memoryCount: c._count.memoryItems,
      ticketCount: c._count.tickets,
    })),
  };
}

export async function loadDriveClientFolder(
  clientId: string,
  ownerUserId: string
): Promise<{ ok: true; folder: DriveClientFolder } | { ok: false; reason: "unavailable" | "not_found" }> {
  const result = await runWithDb(() =>
    prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        companyName: true,
        slug: true,
        contactEmail: true,
        driveFolderUrl: true,
        posts: {
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, captionText: true, status: true, updatedAt: true },
        },
        assets: {
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, name: true, platform: true, updatedAt: true },
        },
        memoryItems: {
          where: { ownerUserId },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: { id: true, title: true, scope: true, updatedAt: true },
        },
        tickets: {
          orderBy: { updatedAt: "desc" },
          take: 15,
          select: { id: true, title: true, status: true, updatedAt: true },
        },
      },
    })
  );

  if (!result.ok) return { ok: false, reason: "unavailable" };
  const c = result.data;
  if (!c) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    folder: {
      client: {
        id: c.id,
        companyName: c.companyName,
        slug: c.slug,
        contactEmail: c.contactEmail,
        driveFolderUrl: c.driveFolderUrl,
      },
      posts: c.posts.map((p) => ({
        id: p.id,
        captionText: p.captionText.slice(0, 80),
        status: p.status,
        updatedAt: p.updatedAt,
      })),
      assets: c.assets.map((a) => ({
        id: a.id,
        name: a.name,
        platform: a.platform,
        updatedAt: a.updatedAt,
      })),
      memoryItems: c.memoryItems.map((m) => ({
        id: m.id,
        title: m.title,
        scope: m.scope,
        updatedAt: m.updatedAt,
      })),
      tickets: c.tickets.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        updatedAt: t.updatedAt,
      })),
    },
  };
}
