import {
  getAgencyPartnerSettings,
  isSapOfficialPartner,
  isZucchettiOfficialPartner,
} from "@/lib/agency-partner-settings";
import { isSapOAuthConfigured, isZucchettiOAuthConfigured } from "@/lib/erp-oauth";
import { isSapApiConfigured, isZucchettiApiConfigured, pullErpTimesheetStatus } from "@/lib/time-erp-certified";

export type ErpPartnerBadge = "certified" | "connected" | "configured" | "off";

export type ErpPartnerStatus = {
  zucchetti: { badge: ErpPartnerBadge; message: string };
  sap: { badge: ErpPartnerBadge; message: string };
};

function badgeFromApi(
  ok: boolean,
  oauth: boolean,
  api: boolean,
  vendor: string,
  official: boolean
): ErpPartnerStatus["zucchetti"] {
  if (official && ok && oauth) {
    return {
      badge: "certified",
      message: `${vendor}: partner ufficiale (env) + API + OAuth verificati.`,
    };
  }
  if (ok && oauth) {
    return { badge: "certified", message: `${vendor}: API + OAuth sandbox OK (partner-ready).` };
  }
  if (oauth) {
    return { badge: "connected", message: `${vendor}: OAuth collegato; verifica endpoint API.` };
  }
  if (api) {
    return { badge: "configured", message: `${vendor}: API key configurata (non verificata).` };
  }
  return { badge: "off", message: `${vendor}: non configurato.` };
}

/** Stato badge partner Zucchetti / SAP per UI Time e go-live. */
export async function getErpPartnerStatus(): Promise<ErpPartnerStatus> {
  const partnerCfg = await getAgencyPartnerSettings();
  const [zHealth, sHealth] = await Promise.all([
    isZucchettiApiConfigured() ? pullErpTimesheetStatus("zucchetti") : Promise.resolve({ ok: false, message: "" }),
    isSapApiConfigured() ? pullErpTimesheetStatus("sap") : Promise.resolve({ ok: false, message: "" }),
  ]);

  return {
    zucchetti: badgeFromApi(
      zHealth.ok,
      isZucchettiOAuthConfigured(),
      isZucchettiApiConfigured(),
      "Zucchetti",
      isZucchettiOfficialPartner(partnerCfg)
    ),
    sap: badgeFromApi(
      sHealth.ok,
      isSapOAuthConfigured(),
      isSapApiConfigured(),
      "SAP",
      isSapOfficialPartner(partnerCfg)
    ),
  };
}
