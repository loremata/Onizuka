/**
 * Scope dati dashboard commerciale (KPI-02).
 *
 * Decisione: il modello `Client` non ha `ownerUserId` — i conteggi clienti
 * (attivi, prospect, dormienti) restano **agency-wide**, come `/admin/clients`.
 * Lead, opportunity, audit, task, quote, Reach e finance sono filtrati per
 * `ownerUserId` della sessione admin.
 *
 * Futura multiutenza: aggiungere `accountOwnerUserId` su Client o derivare
 * il portafoglio da opportunity/audit del commerciale.
 */
export const COMMERCIAL_DASHBOARD_CLIENT_COUNTS_ARE_AGENCY_WIDE = true;

export type CommercialDashboardScopeNote = {
  clientCountsAgencyWide: boolean;
  ownerScopedEntities: readonly string[];
};

export function commercialDashboardScopeNote(): CommercialDashboardScopeNote {
  return {
    clientCountsAgencyWide: COMMERCIAL_DASHBOARD_CLIENT_COUNTS_ARE_AGENCY_WIDE,
    ownerScopedEntities: [
      "Lead",
      "Opportunity",
      "DigitalAudit",
      "FlowTask",
      "OpportunityQuote",
      "OutreachDraft",
      "FinanceEntry",
      "ClientRetailContract",
      "AuditSheetQueueItem",
    ],
  };
}
