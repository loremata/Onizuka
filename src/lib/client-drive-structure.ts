import {
  createClientDriveFolder,
  createDriveSubfolder,
  extractDriveFolderIdFromUrl,
  findDriveChildFolder,
  isGoogleDriveServiceAccountConfigured,
} from "@/lib/google-drive-service";
import { prisma } from "@/lib/prisma";

/** Struttura cartella cliente (master spec §7.11). */
export const CLIENT_DRIVE_FOLDERS = [
  "01_Anagrafica",
  "02_Contratti",
  "03_Preventivi",
  "04_Audit",
  "05_Report",
  "06_Creatività",
  "07_Comunicazioni",
  "08_Fatture",
  "09_Note Interne",
] as const;

export const AUDIT_DRIVE_SUBFOLDER = "04_Audit";

export type ProvisionDriveStructureResult = {
  rootFolderId: string;
  created: number;
  existing: number;
};

export async function provisionDriveSubfolders(parentFolderId: string): Promise<ProvisionDriveStructureResult> {
  let created = 0;
  let existing = 0;

  for (const name of CLIENT_DRIVE_FOLDERS) {
    const found = await findDriveChildFolder(parentFolderId, name);
    if (found) {
      existing += 1;
      continue;
    }
    const sub = await createDriveSubfolder(parentFolderId, name);
    if (sub) created += 1;
  }

  return { rootFolderId: parentFolderId, created, existing };
}

/** Garantisce cartella root cliente + 9 sottocartelle standard. */
export async function ensureClientDriveStructure(clientId: string): Promise<ProvisionDriveStructureResult | null> {
  if (!isGoogleDriveServiceAccountConfigured()) return null;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, companyName: true, driveFolderUrl: true },
  });
  if (!client) return null;

  let rootId = extractDriveFolderIdFromUrl(client.driveFolderUrl);

  if (!rootId) {
    const created = await createClientDriveFolder(`Onizuka · ${client.companyName}`);
    if (!created) return null;
    rootId = created.folderId;
    await prisma.client.update({
      where: { id: clientId },
      data: { driveFolderUrl: created.webViewLink },
    });
  }

  return provisionDriveSubfolders(rootId);
}
