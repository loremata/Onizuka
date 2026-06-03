import { assertProductionDatabaseUrl } from "@/lib/assert-database-url";
import { assertProductionNextAuthEnv } from "@/lib/assert-production-auth-env";
import { assertProductionStorageEnv } from "@/lib/storage";

export function register() {
  // Fuso orario del processo per la formattazione date lato server (Vercel gira in UTC).
  // `TZ` è un nome riservato nelle env Vercel: lo impostiamo qui all'avvio del server.
  // Override opzionale con ONIZUKA_RECAP_TIMEZONE; default Italia.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = process.env.ONIZUKA_RECAP_TIMEZONE?.trim() || "Europe/Rome";
  }

  assertProductionNextAuthEnv();
  assertProductionStorageEnv();
  assertProductionDatabaseUrl();
}
