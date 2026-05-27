-- Preferenza fuso orario recap (IANA) per utente admin/client.

ALTER TABLE "User" ADD COLUMN "timeZone" TEXT;
