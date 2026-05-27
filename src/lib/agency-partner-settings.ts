import { prisma } from "@/lib/prisma";

export type AgencyPartnerConfig = {
  zucchettiOfficial: boolean;
  sapOfficial: boolean;
  zucchettiPartnerRef: string | null;
  sapPartnerRef: string | null;
  zucchettiContractDriveUrl: string | null;
  sapContractDriveUrl: string | null;
  legalArchiveNotes: string | null;
  contractSignedAt: Date | null;
};

export async function getAgencyPartnerSettings(): Promise<AgencyPartnerConfig> {
  const row = await prisma.agencyPartnerSettings.findUnique({ where: { id: "default" } });
  return {
    zucchettiOfficial: row?.zucchettiOfficial ?? false,
    sapOfficial: row?.sapOfficial ?? false,
    zucchettiPartnerRef: row?.zucchettiPartnerRef ?? null,
    sapPartnerRef: row?.sapPartnerRef ?? null,
    zucchettiContractDriveUrl: row?.zucchettiContractDriveUrl ?? null,
    sapContractDriveUrl: row?.sapContractDriveUrl ?? null,
    legalArchiveNotes: row?.legalArchiveNotes ?? null,
    contractSignedAt: row?.contractSignedAt ?? null,
  };
}

export async function saveAgencyPartnerSettings(
  input: Partial<AgencyPartnerConfig>
): Promise<AgencyPartnerConfig> {
  const row = await prisma.agencyPartnerSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      zucchettiOfficial: input.zucchettiOfficial ?? false,
      sapOfficial: input.sapOfficial ?? false,
      zucchettiPartnerRef: input.zucchettiPartnerRef?.slice(0, 120) ?? null,
      sapPartnerRef: input.sapPartnerRef?.slice(0, 120) ?? null,
      zucchettiContractDriveUrl: input.zucchettiContractDriveUrl?.slice(0, 500) ?? null,
      sapContractDriveUrl: input.sapContractDriveUrl?.slice(0, 500) ?? null,
      legalArchiveNotes: input.legalArchiveNotes?.slice(0, 4000) ?? null,
      contractSignedAt: input.contractSignedAt ?? null,
    },
    update: {
      ...(input.zucchettiOfficial !== undefined ? { zucchettiOfficial: input.zucchettiOfficial } : {}),
      ...(input.sapOfficial !== undefined ? { sapOfficial: input.sapOfficial } : {}),
      ...(input.zucchettiPartnerRef !== undefined
        ? { zucchettiPartnerRef: input.zucchettiPartnerRef?.slice(0, 120) ?? null }
        : {}),
      ...(input.sapPartnerRef !== undefined
        ? { sapPartnerRef: input.sapPartnerRef?.slice(0, 120) ?? null }
        : {}),
      ...(input.zucchettiContractDriveUrl !== undefined
        ? { zucchettiContractDriveUrl: input.zucchettiContractDriveUrl?.slice(0, 500) ?? null }
        : {}),
      ...(input.sapContractDriveUrl !== undefined
        ? { sapContractDriveUrl: input.sapContractDriveUrl?.slice(0, 500) ?? null }
        : {}),
      ...(input.legalArchiveNotes !== undefined
        ? { legalArchiveNotes: input.legalArchiveNotes?.slice(0, 4000) ?? null }
        : {}),
      ...(input.contractSignedAt !== undefined ? { contractSignedAt: input.contractSignedAt } : {}),
    },
  });
  return {
    zucchettiOfficial: row.zucchettiOfficial,
    sapOfficial: row.sapOfficial,
    zucchettiPartnerRef: row.zucchettiPartnerRef,
    sapPartnerRef: row.sapPartnerRef,
    zucchettiContractDriveUrl: row.zucchettiContractDriveUrl,
    sapContractDriveUrl: row.sapContractDriveUrl,
    legalArchiveNotes: row.legalArchiveNotes,
    contractSignedAt: row.contractSignedAt,
  };
}

export function isZucchettiOfficialPartner(cfg: AgencyPartnerConfig): boolean {
  return (
    cfg.zucchettiOfficial ||
    process.env.ZUCCHETTI_PARTNER_OFFICIAL === "1" ||
    process.env.ZUCCHETTI_PARTNER_CERTIFIED === "1"
  );
}

export function isSapOfficialPartner(cfg: AgencyPartnerConfig): boolean {
  return (
    cfg.sapOfficial ||
    process.env.SAP_PARTNER_OFFICIAL === "1" ||
    process.env.SAP_PARTNER_CERTIFIED === "1"
  );
}
