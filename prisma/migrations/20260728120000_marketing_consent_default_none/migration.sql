-- Igiene GDPR sul consenso marketing.
--
-- Contesto: `Client.marketingConsentBasis` aveva default SOFT_OPT_IN, quindi ogni
-- record nato dallo scraping se lo ritrovava addosso. In produzione erano 1028 su
-- 1028, di cui 1026 in stato LEAD. Il soft opt-in (art. 130 c.4 Codice Privacy)
-- copre pero' solo chi ha gia' acquistato, e per prodotti analoghi: su un'azienda
-- presa da fonti pubbliche non e' una base giuridica.
--
-- 1) Il default diventa NONE: il soft opt-in va assegnato di proposito.
ALTER TABLE "Client" ALTER COLUMN "marketingConsentBasis" SET DEFAULT 'NONE';

-- 2) Riporta a NONE i soggetti che non sono clienti: nessuno di loro ha mai
--    comprato nulla, quindi nessuno di loro puo' avere il soft opt-in.
--    I clienti veri (relationshipState = 'CLIENTE') restano come sono.
UPDATE "Client"
   SET "marketingConsentBasis" = 'NONE'
 WHERE "relationshipState" <> 'CLIENTE'
   AND "marketingConsentBasis" = 'SOFT_OPT_IN';
