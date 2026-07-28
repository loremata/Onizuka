-- Assegna la base giuridica ai lead gia' a sistema, distinguendo il rischio.
--
-- Criterio: conta a chi appartiene la casella, non chi e' l'intestatario.
--  - dominio aziendale (info@officina.it, commerciale@bar.com) → LEGITIMATE_INTEREST:
--    e' il contatto pubblico dell'impresa, l'outreach B2B con origine dichiarata e
--    opt-out e' difendibile;
--  - casella di posta gratuita (gmail, libero, hotmail…) → resta NONE: e' di fatto
--    l'indirizzo personale di una persona fisica, che merita un consenso vero;
--  - nessuna email o segnaposto interno → resta NONE, non e' contattabile comunque.
--
-- I clienti veri (relationshipState = 'CLIENTE') non vengono toccati: hanno gia'
-- SOFT_OPT_IN, che per loro e' la base corretta.
UPDATE "Client"
   SET "marketingConsentBasis" = 'LEGITIMATE_INTEREST'
 WHERE "relationshipState" <> 'CLIENTE'
   AND "marketingConsentBasis" = 'NONE'
   AND "marketingOptOutAt" IS NULL
   AND "contactEmail" IS NOT NULL
   AND "contactEmail" <> ''
   AND "contactEmail" NOT ILIKE '%@onizuka.local'
   AND "contactEmail" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
   AND lower(split_part("contactEmail", '@', 2)) NOT IN (
     'gmail.com', 'googlemail.com', 'libero.it', 'hotmail.it', 'hotmail.com',
     'outlook.it', 'outlook.com', 'live.it', 'live.com', 'yahoo.it', 'yahoo.com',
     'tiscali.it', 'alice.it', 'virgilio.it', 'icloud.com', 'me.com', 'aol.com',
     'tin.it', 'email.it', 'inwind.it', 'teletu.it', 'fastwebnet.it', 'tim.it',
     'gmx.com', 'protonmail.com', 'proton.me', 'yandex.com', 'msn.com'
   );
