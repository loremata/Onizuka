import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const clients = new Map<string, PrismaClient>();

function parseWorkspaceDatabaseMap(): Record<string, string> {
  const raw = process.env.ONIZUKA_WORKSPACE_DATABASES?.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/** URL DB dedicato per workspace (env map o colonna databaseUrl). */
export async function resolveWorkspaceDatabaseUrl(workspaceId: string): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { databaseSlug: true, databaseUrl: true },
  });
  if (!ws) return null;
  if (ws.databaseUrl?.trim()) return ws.databaseUrl.trim();
  if (ws.databaseSlug) {
    const map = parseWorkspaceDatabaseMap();
    const url = map[ws.databaseSlug] ?? map[workspaceId];
    if (url?.trim()) return url.trim();
  }
  return null;
}

/** Client Prisma per DB tenant (cache per processo). */
export async function getWorkspacePrisma(workspaceId: string): Promise<PrismaClient> {
  const url = await resolveWorkspaceDatabaseUrl(workspaceId);
  if (!url) return prisma;

  const cached = clients.get(workspaceId);
  if (cached) return cached;

  const client = new PrismaClient({
    datasources: { db: { url } },
  });
  clients.set(workspaceId, client);
  return client;
}

export function isWorkspaceDatabaseIsolated(workspace: {
  databaseSlug: string | null;
  databaseUrl: string | null;
}): boolean {
  return !!(workspace.databaseUrl?.trim() || workspace.databaseSlug);
}
