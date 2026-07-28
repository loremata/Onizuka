-- L'amministrazione contabile esce da Onizuka: fatture elettroniche, SDI,
-- pagamenti Stripe, export gestionale e push ore verso ERP sono del
-- commercialista. Onizuka resta il registro gestionale (tracking, punto della
-- situazione, consigli). Rimossi i campi e le tabelle che servivano solo a
-- quella filiera. `FinanceEntry.invoiceNumber` RESTA: ora e' il riferimento
-- manuale alla fattura emessa dal commercialista.
--
-- Dati persi (accettato): eventuali id sessione Stripe e timestamp SDI
-- (in produzione: nessun pagamento Stripe mai registrato), log push ERP,
-- flag partner ERP, conti PDC per cliente.

ALTER TABLE "FinanceEntry" DROP COLUMN IF EXISTS "sdiExportedAt";
ALTER TABLE "FinanceEntry" DROP COLUMN IF EXISTS "stripeCheckoutSessionId";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "accountingCode";
DROP TABLE IF EXISTS "TimeErpPushLog";
DROP TABLE IF EXISTS "AgencyPartnerSettings";

-- I valori enum ZUCCHETTI_ERP/SAP_ERP di "OAuthProvider" restano (Postgres non
-- permette di rimuoverli); eventuali connessioni OAuth ERP non hanno piu' senso.
DELETE FROM "UserOAuthConnection" WHERE provider IN ('ZUCCHETTI_ERP', 'SAP_ERP');
