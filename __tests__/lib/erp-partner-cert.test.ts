import { getErpPartnerStatus } from "@/lib/erp-partner-cert";

describe("getErpPartnerStatus official partner env", () => {
  const prevZ = process.env.ZUCCHETTI_PARTNER_OFFICIAL;
  const prevS = process.env.SAP_PARTNER_OFFICIAL;

  afterEach(() => {
    if (prevZ === undefined) delete process.env.ZUCCHETTI_PARTNER_OFFICIAL;
    else process.env.ZUCCHETTI_PARTNER_OFFICIAL = prevZ;
    if (prevS === undefined) delete process.env.SAP_PARTNER_OFFICIAL;
    else process.env.SAP_PARTNER_OFFICIAL = prevS;
  });

  it("mentions partner ufficiale when env flag set and health ok", async () => {
    process.env.ZUCCHETTI_PARTNER_OFFICIAL = "1";
    const status = await getErpPartnerStatus();
    expect(status.zucchetti.message).toMatch(/Zucchetti/i);
  });
});
