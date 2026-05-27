import { assertProductionDatabaseUrl } from "@/lib/assert-database-url";
import { assertProductionNextAuthEnv } from "@/lib/assert-production-auth-env";
import { assertProductionStorageEnv } from "@/lib/storage";

export function register() {
  assertProductionNextAuthEnv();
  assertProductionStorageEnv();
  assertProductionDatabaseUrl();
}
