/**
 * Seed dedicato ambiente staging remoto.
 * Record prefissati "STAGING TEST" — nessun dato reale.
 * Uso: npm run staging:seed (richiede ONIZUKA_ENV=staging + guard).
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedCommercialCatalog } from "../src/lib/commercial-catalog-seed";
import { assertStagingEnvironment } from "../src/lib/staging-guard";

const PREFIX = "STAGING TEST";
const prisma = new PrismaClient();

async function main() {
  if (process.env.ONIZUKA_STAGING_SEED !== "1") {
    throw new Error("Imposta ONIZUKA_STAGING_SEED=1 (via npm run staging:seed).");
  }
  assertStagingEnvironment({ requireStagingEnv: true, requireConfirm: true });

  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@agency.com" },
    update: {
      passwordHash: adminPassword,
      role: "ADMIN",
      mustChangePassword: false,
      clientId: null,
    },
    create: {
      email: "admin@agency.com",
      name: `${PREFIX} Admin`,
      passwordHash: adminPassword,
      role: "ADMIN",
      mustChangePassword: false,
    },
  });

  await seedCommercialCatalog();

  const slug = "staging-test-client";
  const client = await prisma.client.upsert({
    where: { slug },
    update: {
      companyName: `${PREFIX} Client Co`,
      contactEmail: "staging-test-client@example.test",
      status: "LEAD_QUALIFIED",
      website: "https://staging-test.example.test",
      city: "Milano",
      notes: `${PREFIX} — client fictizio per gate/E2E.`,
    },
    create: {
      companyName: `${PREFIX} Client Co`,
      slug,
      contactEmail: "staging-test-client@example.test",
      status: "LEAD_QUALIFIED",
      website: "https://staging-test.example.test",
      city: "Milano",
      notes: `${PREFIX} — client fictizio per gate/E2E.`,
    },
  });

  const lead = await prisma.lead.upsert({
    where: { id: "staging_test_lead" },
    update: {
      title: `${PREFIX} Lead`,
      businessName: `${PREFIX} Prospect`,
      email: "staging-test-lead@example.test",
      status: "QUALIFIED",
      source: "staging_seed",
      ownerUserId: admin.id,
      notes: PREFIX,
    },
    create: {
      id: "staging_test_lead",
      title: `${PREFIX} Lead`,
      businessName: `${PREFIX} Prospect`,
      email: "staging-test-lead@example.test",
      status: "QUALIFIED",
      source: "staging_seed",
      ownerUserId: admin.id,
      notes: PREFIX,
    },
  });

  const service = await prisma.commercialService.findFirst({ select: { id: true } });
  const opp = await prisma.opportunity.upsert({
    where: { id: "staging_test_opp" },
    update: {
      title: `${PREFIX} Opportunità aperta`,
      clientId: client.id,
      ownerUserId: admin.id,
      status: "OPEN",
      priority: "MEDIUM",
      source: "staging_seed",
    },
    create: {
      id: "staging_test_opp",
      title: `${PREFIX} Opportunità aperta`,
      clientId: client.id,
      ownerUserId: admin.id,
      status: "OPEN",
      priority: "MEDIUM",
      source: "staging_seed",
    },
  });

  const audit = await prisma.digitalAudit.upsert({
    where: { id: "staging_test_audit" },
    update: {
      businessName: `${PREFIX} Audit`,
      clientId: client.id,
      ownerUserId: admin.id,
      status: "COMPLETED",
      overallScore: 55,
      recommendedServiceId: service?.id ?? null,
    },
    create: {
      id: "staging_test_audit",
      businessName: `${PREFIX} Audit`,
      clientId: client.id,
      ownerUserId: admin.id,
      status: "COMPLETED",
      overallScore: 55,
      recommendedServiceId: service?.id ?? null,
    },
  });

  await prisma.flowTask.upsert({
    where: { id: "staging_test_task" },
    update: {
      title: `${PREFIX} Task follow-up`,
      ownerUserId: admin.id,
      relatedClientId: client.id,
      status: "TODO",
      priority: "MEDIUM",
      source: "staging_seed",
    },
    create: {
      id: "staging_test_task",
      title: `${PREFIX} Task follow-up`,
      ownerUserId: admin.id,
      relatedClientId: client.id,
      status: "TODO",
      priority: "MEDIUM",
      source: "staging_seed",
    },
  });

  await prisma.opportunityQuote.upsert({
    where: { id: "staging_test_quote" },
    update: {
      opportunityId: opp.id,
      ownerUserId: admin.id,
      title: `${PREFIX} Preventivo draft`,
      linesJson: "[]",
      taxPercent: 22,
      status: "DRAFT",
    },
    create: {
      id: "staging_test_quote",
      opportunityId: opp.id,
      ownerUserId: admin.id,
      title: `${PREFIX} Preventivo draft`,
      linesJson: "[]",
      taxPercent: 22,
      status: "DRAFT",
    },
  });

  console.log(`${PREFIX} seed complete:`);
  console.log("  Admin: admin@agency.com / admin123");
  console.log("  Client:", client.companyName);
  console.log("  Lead:", lead.businessName);
  console.log("  Opportunity:", opp.title);
  console.log("  Audit:", audit.businessName);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
