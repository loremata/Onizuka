import { cleanupE2eAuditRecords, disconnectE2ePrisma } from "./fixtures/commercial-audit-e2e";

export default async function globalTeardown() {
  await cleanupE2eAuditRecords({ businessNamePrefix: "E2E Audit CRM" });
  await disconnectE2ePrisma();
}
