"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { saveAgencyPartnerSettings } from "@/lib/agency-partner-settings";

export async function updateAgencyPartnerCertAction(input: {
  zucchettiOfficial: boolean;
  sapOfficial: boolean;
  zucchettiPartnerRef?: string;
  sapPartnerRef?: string;
  zucchettiContractDriveUrl?: string;
  sapContractDriveUrl?: string;
  legalArchiveNotes?: string;
}): Promise<{ error?: string }> {
  await requireFullAdmin();
  await saveAgencyPartnerSettings({
    zucchettiOfficial: input.zucchettiOfficial,
    sapOfficial: input.sapOfficial,
    zucchettiPartnerRef: input.zucchettiPartnerRef?.trim() || null,
    sapPartnerRef: input.sapPartnerRef?.trim() || null,
    zucchettiContractDriveUrl: input.zucchettiContractDriveUrl?.trim() || null,
    sapContractDriveUrl: input.sapContractDriveUrl?.trim() || null,
    legalArchiveNotes: input.legalArchiveNotes?.trim() || null,
    contractSignedAt:
      input.zucchettiOfficial || input.sapOfficial ? new Date() : null,
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/time");
  revalidatePath("/admin/go-live");
  return {};
}
