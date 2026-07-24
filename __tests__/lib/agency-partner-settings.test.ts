import {
  isSapOfficialPartner,
  isZucchettiOfficialPartner,
  type AgencyPartnerConfig,
} from "@/lib/agency-partner-settings";

describe("agency partner official flags", () => {
  const base: AgencyPartnerConfig = {
    zucchettiOfficial: false,
    sapOfficial: false,
    zucchettiPartnerRef: null,
    sapPartnerRef: null,
    zucchettiContractDriveUrl: null,
    sapContractDriveUrl: null,
    legalArchiveNotes: null,
    contractSignedAt: null,
  };

  it("reads DB flag for zucchetti", () => {
    expect(isZucchettiOfficialPartner({ ...base, zucchettiOfficial: true })).toBe(true);
  });

  it("falls back to env for sap", () => {
    process.env.SAP_PARTNER_OFFICIAL = "1";
    expect(isSapOfficialPartner(base)).toBe(true);
    delete process.env.SAP_PARTNER_OFFICIAL;
  });
});
