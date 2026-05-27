import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace-scope";
import { WorkspaceSwitcherClient } from "./workspace-switcher-client";

export async function WorkspaceSwitcher() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, isolated: true },
  });
  const activeId = await getActiveWorkspaceId();
  return <WorkspaceSwitcherClient workspaces={workspaces} activeId={activeId} />;
}
