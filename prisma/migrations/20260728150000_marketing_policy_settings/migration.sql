-- Politica di classificazione configurabile + rimozione della discriminazione
-- per provider di posta.
--
-- Cambio di criterio: un'impresa che pubblica `mario.rossi@gmail.com` sulla
-- propria scheda Google sta pubblicando il proprio recapito commerciale
-- esattamente come chi pubblica `info@azienda.it`. Escludere le caselle gratuite
-- tagliava fuori la maggior parte delle piccole attivita' senza aggiungere
-- tutela: conta che il recapito sia pubblico e riferito all'attivita', non chi
-- fornisce la casella.

-- 1) Impostazioni per titolare.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "marketingAutoBasis" "MarketingConsentBasis" NOT NULL DEFAULT 'LEGITIMATE_INTEREST',
  ADD COLUMN IF NOT EXISTS "marketingExcludedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2) Riclassifica i contatti esclusi dal criterio precedente solo perche' il
--    dominio era di un provider consumer. Restano fuori: chi si e' disiscritto,
--    chi non ha un indirizzo utilizzabile, i segnaposto interni e i clienti veri
--    (che hanno gia' SOFT_OPT_IN, base piu' solida).
UPDATE "Client"
   SET "marketingConsentBasis" = 'LEGITIMATE_INTEREST'
 WHERE "relationshipState" <> 'CLIENTE'
   AND "marketingConsentBasis" = 'NONE'
   AND "marketingOptOutAt" IS NULL
   AND "contactEmail" IS NOT NULL
   AND "contactEmail" <> ''
   AND "contactEmail" NOT ILIKE '%@onizuka.local'
   AND "contactEmail" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
