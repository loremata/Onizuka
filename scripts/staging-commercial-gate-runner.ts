/**
 * ST-02 — Staging validation gate (commercial CRM).
 * Uso: DATABASE_URL=… npx tsx scripts/staging-commercial-gate-runner.ts
 * NON eseguire su produzione (verifica host/marker).
 */
import { PrismaClient } from "@prisma/client";
import { prepareAuditCommercialTarget } from "../src/lib/audit-commercial-match";
import { runDigitalAuditUnified } from "../src/lib/audit-commercial-entry";
import { ensureOpportunityFromDigitalAudit } from "../src/lib/audit-opportunity-from-audit";
import { processNonVatSheetQueueItem } from "../src/lib/audit-sheet-domain-row";
import { buildAuditSheetRowKey, parseAuditSheetCsv } from "../src/lib/audit-sheet-ingest";
import { scheduleQuoteNoResponseReminder } from "../src/lib/quote-no-response";
import { assertOpportunityParty } from "../src/lib/opportunity-party";
import { normalizeWebsiteDomain } from "../src/lib/audit-commercial-match";
import { loadCommercialDashboard } from "../src/lib/commercial-dashboard";
import { loadAuditFollowUpSummary } from "../src/lib/commercial-audit-follow-up";
import { assertCommercialGateSafe } from "../src/lib/staging-guard";
import { quoteEmailEnabled } from "../src/lib/quote-email";

const prisma = new PrismaClient();
const stamp = `ST02_${Date.now().toString(36)}`;
const created = {
  clientIds: [] as string[],
  leadIds: [] as string[],
  auditIds: [] as string[],
  oppIds: [] as string[],
  quoteIds: [] as string[],
  taskIds: [] as string[],
  queueIds: [] as string[],
};

type SmokeResult = {
  id: string;
  ok: boolean;
  expected: string;
  got: string;
  error?: string;
};

const results: SmokeResult[] = [];

function record(id: string, ok: boolean, expected: string, got: string, error?: string) {
  results.push({ id, ok, expected, got, error });
  const icon = ok ? "OK" : "FAIL";
  console.log(`[${icon}] ${id}: ${got}${error ? ` (${error})` : ""}`);
}

function maskDbUrl(url: string | undefined): string {
  if (!url) return "(unset)";
  try {
    const u = new URL(url.replace(/^postgresql:/, "http:"));
    return `${u.hostname}:${u.port || "5432"}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "(invalid url)";
  }
}

function assertNotProduction() {
  assertCommercialGateSafe();
}

async function schemaGate() {
  const cols = await prisma.$queryRaw<{ table_name: string; column_name: string; is_nullable: string }[]>`
    SELECT table_name, column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'Opportunity' AND column_name IN ('leadId', 'clientId'))
        OR (table_name = 'Lead' AND column_name IN ('googlePlaceId', 'website', 'city'))
        OR (table_name = 'AuditSheetQueueItem' AND column_name IN ('vatNumber', 'city'))
      )
  `;
  const need = [
    ["Opportunity", "leadId"],
    ["Opportunity", "clientId"],
    ["Lead", "googlePlaceId"],
    ["Lead", "website"],
    ["Lead", "city"],
    ["AuditSheetQueueItem", "vatNumber"],
    ["AuditSheetQueueItem", "city"],
  ];
  for (const [t, c] of need) {
    const row = cols.find((r) => r.table_name === t && r.column_name === c);
    const ok = Boolean(row);
    record(`schema.${t}.${c}`, ok, "exists", ok ? "exists" : "missing");
  }
  const clientNullable = cols.find((r) => r.table_name === "Opportunity" && r.column_name === "clientId");
  record(
    "schema.Opportunity.clientId.nullable",
    clientNullable?.is_nullable === "YES",
    "YES",
    clientNullable?.is_nullable ?? "?"
  );
}

async function cleanup() {
  for (const id of created.quoteIds) {
    await prisma.opportunityQuote.delete({ where: { id } }).catch(() => undefined);
  }
  for (const id of created.oppIds) {
    await prisma.opportunityQuote.deleteMany({ where: { opportunityId: id } }).catch(() => undefined);
    await prisma.opportunity.delete({ where: { id } }).catch(() => undefined);
  }
  for (const id of created.auditIds) {
    await prisma.digitalAuditSection.deleteMany({ where: { digitalAuditId: id } }).catch(() => undefined);
    await prisma.digitalAudit.delete({ where: { id } }).catch(() => undefined);
  }
  for (const id of created.taskIds) {
    await prisma.flowTask.delete({ where: { id } }).catch(() => undefined);
  }
  for (const id of created.queueIds) {
    await prisma.auditSheetQueueItem.delete({ where: { id } }).catch(() => undefined);
  }
  for (const id of created.leadIds) {
    await prisma.lead.delete({ where: { id } }).catch(() => undefined);
  }
  for (const id of created.clientIds) {
    await prisma.client.delete({ where: { id } }).catch(() => undefined);
  }
}

async function main() {
  assertNotProduction();
  console.log("ST-02 commercial gate");
  console.log("DB:", maskDbUrl(process.env.DATABASE_URL));
  console.log("ONIZUKA_ENV:", process.env.ONIZUKA_ENV ?? "(unset)");
  console.log("stamp:", stamp);

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Nessun utente ADMIN.");
  const ownerUserId = admin.id;

  await schemaGate();

  const vatNew = `IT9${stamp.replace(/\D/g, "").slice(0, 10).padEnd(10, "0")}`.slice(0, 13);

  try {
    const t1 = await prepareAuditCommercialTarget({
      ownerUserId,
      vatNumber: vatNew,
      businessName: `TEST ${stamp}`,
      acquisitionSource: "vat_form",
    });
    created.clientIds.push(t1.clientId);
    if (t1.leadId) created.leadIds.push(t1.leadId);
    record("smoke.audit.vat.new", t1.matchKind === "new_prospect", "new_prospect", t1.matchKind);

    const t2 = await prepareAuditCommercialTarget({
      ownerUserId,
      vatNumber: vatNew,
      businessName: `TEST ${stamp}`,
    });
    record(
      "smoke.audit.vat.reuse",
      t2.clientId === t1.clientId && t2.matchKind !== "new_prospect",
      "same client",
      `${t2.clientId} / ${t2.matchKind}`
    );

    const auditRun = await runDigitalAuditUnified({
      ownerUserId,
      vatNumber: vatNew,
      businessName: `TEST ${stamp}`,
      acquisitionSource: "vat_form",
    });
    created.auditIds.push(auditRun.auditId);
    const auditRow = await prisma.digitalAudit.findUnique({
      where: { id: auditRun.auditId },
      select: { leadId: true, clientId: true },
    });
    record(
      "smoke.audit.wire",
      Boolean(auditRow?.leadId && auditRow?.clientId),
      "leadId+clientId",
      `${auditRow?.leadId ?? "-"} / ${auditRow?.clientId ?? "-"}`
    );

    const domain = `st02-${stamp}.example.test`;
    const domainNorm = normalizeWebsiteDomain(`https://www.${domain}/`);
    const parsed = parseAuditSheetCsv(`sito\nhttps://www.${domain}/\n`);
    record("smoke.sheet.parse.domain", parsed.rows[0]?.kind === "domain", "domain", parsed.rows[0]?.kind ?? "-");
    record(
      "smoke.sheet.domain.normalize",
      domainNorm === domain.toLowerCase(),
      domain.toLowerCase(),
      domainNorm ?? "null"
    );

    const queue = await prisma.auditSheetQueueItem.create({
      data: {
        ownerUserId,
        website: `https://${domain}`,
        sheetRowKey: buildAuditSheetRowKey(parsed.rows[0]!),
        status: "PENDING",
      },
    });
    created.queueIds.push(queue.id);
    const sheetRes = await processNonVatSheetQueueItem(queue);
    record(
      "smoke.sheet.domain.process",
      sheetRes.status === "SKIPPED" || sheetRes.status === "DONE",
      "SKIPPED|DONE",
      sheetRes.status
    );
    if (sheetRes.leadId) created.leadIds.push(sheetRes.leadId);

    const service = await prisma.commercialService.findFirst({ select: { id: true } });
    if (!service) throw new Error("commercialService missing");

    const leadOnly = await prisma.lead.create({
      data: {
        ownerUserId,
        title: `TEST lead-only ${stamp}`,
        businessName: `TEST Lead ${stamp}`,
        email: `test.${stamp}@example.test`,
        status: "QUALIFIED",
        source: "st02_gate",
        commercialProspectStage: "AUDIT_IN_PROGRESS",
        clientMacroCategory: "DIGITAL_AI",
      },
    });
    created.leadIds.push(leadOnly.id);

    const auditLead = await prisma.digitalAudit.create({
      data: {
        ownerUserId,
        leadId: leadOnly.id,
        businessName: leadOnly.businessName,
        status: "COMPLETED",
        overallScore: 40,
        recommendedServiceId: service.id,
      },
    });
    created.auditIds.push(auditLead.id);

    const oppLead = await ensureOpportunityFromDigitalAudit({
      ownerUserId,
      auditId: auditLead.id,
      leadId: leadOnly.id,
    });
    record(
      "smoke.opp.lead-only",
      Boolean(oppLead?.opportunityId),
      "created",
      oppLead?.opportunityId ?? "none"
    );
    if (oppLead?.opportunityId) {
      created.oppIds.push(oppLead.opportunityId);
      const oppRow = await prisma.opportunity.findUniqueOrThrow({
        where: { id: oppLead.opportunityId },
        select: { clientId: true, leadId: true, source: true },
      });
      record(
        "smoke.opp.lead-only.row",
        oppRow.leadId === leadOnly.id && oppRow.clientId == null,
        "leadId only",
        `lead=${oppRow.leadId} client=${oppRow.clientId}`
      );

      const quote = await prisma.opportunityQuote.create({
        data: {
          ownerUserId,
          opportunityId: oppLead.opportunityId,
          title: `TEST quote ${stamp}`,
          linesJson: "[]",
          taxPercent: 22,
          status: "SENT",
          sentAt: new Date(),
        },
      });
      created.quoteIds.push(quote.id);
      await scheduleQuoteNoResponseReminder(quote.id);
      const task = await prisma.flowTask.findFirst({
        where: { ownerUserId, source: "quote_no_response", title: { contains: "Proposta non risposta" } },
        orderBy: { createdAt: "desc" },
      });
      record(
        "smoke.quote-no-response.lead",
        Boolean(task),
        "task created",
        task ? `task ${task.id}` : "none"
      );
      if (task) created.taskIds.push(task.id);
    }

    record(
      "smoke.party.assert",
      assertOpportunityParty({ leadId: leadOnly.id }) == null,
      "null error",
      String(assertOpportunityParty({ leadId: leadOnly.id }))
    );

    record(
      "smoke.email.quote-disabled",
      !quoteEmailEnabled(),
      "no real SMTP send",
      quoteEmailEnabled() ? "SMTP active" : "disabled/sandbox"
    );
    record(
      "smoke.env.quote-notify",
      process.env.QUOTE_NOTIFY_EMAIL !== "1",
      "QUOTE_NOTIFY_EMAIL not forced on",
      process.env.QUOTE_NOTIFY_EMAIL ?? "unset"
    );

    const dash = await loadCommercialDashboard(ownerUserId, "Europe/Rome", {
      period: "30",
      incompleteOnly: false,
    });
    record(
      "smoke.dashboard.load",
      dash.ok === true,
      "dashboard ok",
      dash.ok ? `${dash.data.kpis.length} KPI` : String((dash as { reason?: string }).reason)
    );

    const followUp = await loadAuditFollowUpSummary(ownerUserId, null, 20);
    record(
      "smoke.dashboard.audit-followup",
      typeof followUp.withoutFollowUpTotal === "number",
      "summary ok",
      `sample=${followUp.sampleSize} gaps=${followUp.withoutFollowUpTotal}`
    );

    const orphanCount = await prisma.opportunity.count({
      where: { ownerUserId, status: "OPEN", clientId: null, leadId: null },
    });
    record("smoke.dashboard.orphan-opp", true, "count ok", String(orphanCount));

    try {
      await prepareAuditCommercialTarget({
        ownerUserId,
        googlePlaceId: `ChIJ_TEST_${stamp}`,
        businessName: `Places ${stamp}`,
        acquisitionSource: "google_places",
      });
      record("smoke.places.no-vat", false, "throw", "no throw");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      record(
        "smoke.places.no-vat",
        /P\.IVA|fiscali|Impossibile/i.test(msg),
        "guided error",
        msg.slice(0, 80)
      );
    }
  } finally {
    console.log("\nCleanup…");
    await cleanup();
    console.log("Cleanup done.");
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Summary ---");
  console.log(`Total: ${results.length}, OK: ${results.length - failed.length}, FAIL: ${failed.length}`);
  if (failed.length) {
    console.log("Failures:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
  console.log("ST-02 gate: PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
