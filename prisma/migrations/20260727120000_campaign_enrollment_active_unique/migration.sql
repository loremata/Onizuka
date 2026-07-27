-- Rete di sicurezza (Fase 1): impedisce due iscrizioni ACTIVE per lo stesso
-- (cliente, campagna) — guardia anti-TOCTOU su run concorrenti del cron.
-- Indice unico PARZIALE (non esprimibile in schema Prisma): applicato via SQL,
-- annotato nel modello CampaignEnrollment. NON rimuovere con migrate dev.
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignEnrollment_active_unique"
  ON "CampaignEnrollment" ("clientId", "campaignId")
  WHERE status = 'ACTIVE';
