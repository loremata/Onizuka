import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin-audit-log";
import { ensureClientDriveStructure } from "@/lib/client-drive-structure";
import { isGoogleDriveServiceAccountConfigured } from "@/lib/google-drive-service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!isGoogleDriveServiceAccountConfigured()) {
    return NextResponse.json(
      { error: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON non configurato" },
      { status: 503 }
    );
  }

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, companyName: true, driveFolderUrl: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const hadFolder = Boolean(client.driveFolderUrl?.trim());
  const provisioned = await ensureClientDriveStructure(id);
  if (!provisioned) {
    return NextResponse.json({ error: "Creazione struttura Drive fallita" }, { status: 502 });
  }

  const updated = await prisma.client.findUnique({
    where: { id },
    select: { driveFolderUrl: true },
  });

  void logAdminAction({
    actorUserId: session.user.id,
    action: "client.update",
    entityType: "client",
    entityId: id,
    summary: `Struttura Drive (${provisioned.created} nuove sottocartelle) per «${client.companyName}»`,
    metadata: {
      driveFolderId: provisioned.rootFolderId,
      subfoldersCreated: provisioned.created,
    },
  });

  return NextResponse.json({
    ok: true,
    alreadyExists: hadFolder,
    driveFolderUrl: updated?.driveFolderUrl,
    folderId: provisioned.rootFolderId,
    subfoldersCreated: provisioned.created,
    subfoldersExisting: provisioned.existing,
  });
}
