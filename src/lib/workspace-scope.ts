import type { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { getWorkspacePrisma } from "@/lib/workspace-database";
import { prisma } from "@/lib/prisma";

const COOKIE = "onizuka_workspace_id";

export async function getActiveWorkspaceId(fallbackUserWorkspaceId?: string | null): Promise<string> {
  const jar = await cookies();
  const fromCookie = jar.get(COOKIE)?.value?.trim();
  if (fromCookie) {
    const ws = await prisma.workspace.findUnique({ where: { id: fromCookie }, select: { id: true } });
    if (ws) return ws.id;
  }
  return fallbackUserWorkspaceId?.trim() || "ws_default";
}

export async function setActiveWorkspaceCookie(workspaceId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

/** Prisma per workspace attivo (DB dedicato se `databaseUrl` / env map). */
export async function getScopedPrisma(userWorkspaceId?: string | null): Promise<PrismaClient> {
  const wsId = await getActiveWorkspaceId(userWorkspaceId);
  return getWorkspacePrisma(wsId);
}

/** Filtro Prisma per clienti quando workspace è isolated. */
export async function clientWorkspaceWhere(
  userWorkspaceId?: string | null
): Promise<{ workspaceId?: string } | Record<string, never>> {
  const wsId = await getActiveWorkspaceId(userWorkspaceId);
  const ws = await prisma.workspace.findUnique({
    where: { id: wsId },
    select: { isolated: true },
  });
  if (!ws?.isolated) return {};
  return { workspaceId: wsId };
}
