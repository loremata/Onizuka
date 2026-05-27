/** Validazione collegamento Opportunity ↔ Lead/Client (AP-02). */

export type OpportunityPartyInput = {
  clientId?: string | null;
  leadId?: string | null;
};

export function assertOpportunityParty(input: OpportunityPartyInput): string | null {
  const hasClient = Boolean(input.clientId?.trim());
  const hasLead = Boolean(input.leadId?.trim());
  if (!hasClient && !hasLead) {
    return "Seleziona almeno un cliente o un lead per l'opportunità.";
  }
  return null;
}
