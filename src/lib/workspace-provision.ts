import { execFile } from "child_process";
import { promisify } from "util";
import { resolveWorkspaceDatabaseUrl } from "@/lib/workspace-database";
import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);

export type WorkspaceProvisionResult =
  | { ok: true; migratedAt: Date }
  | { ok: false; error: string };

/** Applica `prisma migrate deploy` sul database tenant del workspace. */
export async function provisionWorkspaceDatabase(workspaceId: string): Promise<WorkspaceProvisionResult> {
  const url = await resolveWorkspaceDatabaseUrl(workspaceId);
  if (!url) {
    return { ok: false, error: "Configura databaseUrl o ONIZUKA_WORKSPACE_DATABASES per questo workspace." };
  }

  try {
    await execFileAsync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["prisma", "migrate", "deploy"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: url,
          DIRECT_URL: url,
        },
        timeout: 180_000,
        maxBuffer: 2 * 1024 * 1024,
      }
    );

    const migratedAt = new Date();
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { databaseProvisionedAt: migratedAt },
    });

    return { ok: true, migratedAt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 2000) };
  }
}

export async function checkWorkspaceDatabaseHealth(workspaceId: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const url = await resolveWorkspaceDatabaseUrl(workspaceId);
  if (!url) return { ok: false, message: "Nessun DB dedicato configurato." };

  const { PrismaClient } = await import("@prisma/client");
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    await client.$queryRaw`SELECT 1`;
    return { ok: true, message: "Connessione tenant OK." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  } finally {
    await client.$disconnect();
  }
}
