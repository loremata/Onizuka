import { PrismaClient, Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedCommercialCatalog } from "../src/lib/commercial-catalog-seed";
import {
  SEED_DEMO_APPROVED_POST_ID,
  SEED_DEMO_PENDING_POST_ID,
  SEED_FLOW_TASK_ALPHA,
  SEED_FLOW_TASK_BETA,
  SEED_MEMORY_DEMO_CLIENT,
  SEED_LEAD_DEMO,
  SEED_ASSET_DEMO,
  SEED_OPPORTUNITY_DEMO,
  SEED_CONTACT_DEMO,
} from "../e2e/seed-constants";

const prisma = new PrismaClient();

async function main() {
  const forceDemoPasswordChange = process.env.ONIZUKA_E2E !== "1";
  const demoPasswordFlags = { mustChangePassword: forceDemoPasswordChange };
  const adminPassword = await hash("admin123", 12);
  const clientPassword = await hash("client123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@agency.com" },
    update: {
      ...demoPasswordFlags,
      passwordHash: adminPassword,
      role: "ADMIN",
      clientId: null,
    },
    create: {
      email: "admin@agency.com",
      name: "Admin User",
      passwordHash: adminPassword,
      role: "ADMIN",
      mustChangePassword: forceDemoPasswordChange,
    },
  });

  const staffPassword = await hash("staff123", 12);
  await prisma.user.upsert({
    where: { email: "staff@agency.com" },
    update: {
      ...demoPasswordFlags,
      passwordHash: staffPassword,
      role: "STAFF",
      clientId: null,
    },
    create: {
      email: "staff@agency.com",
      name: "Staff Collaborator",
      passwordHash: staffPassword,
      role: "STAFF",
      mustChangePassword: forceDemoPasswordChange,
    },
  });

  const client = await prisma.client.upsert({
    where: { slug: "demo-client" },
    update: {
      status: "ACTIVE_CLIENT",
      notes: "Cliente seed per E2E e demo Onizuka.",
      vatNumber: "IT00000000000",
      phone: "+39 000 0000000",
      website: "https://example.com",
      city: "Milano",
      country: "IT",
    },
    create: {
      companyName: "Demo Client Co",
      slug: "demo-client",
      contactEmail: "contact@democlient.com",
      status: "ACTIVE_CLIENT",
      notes: "Cliente seed per E2E e demo Onizuka.",
      vatNumber: "IT00000000000",
      phone: "+39 000 0000000",
      website: "https://example.com",
      city: "Milano",
      country: "IT",
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: "client@democlient.com" },
    update: {
      ...demoPasswordFlags,
      passwordHash: clientPassword,
      role: "CLIENT",
      clientId: client.id,
    },
    create: {
      email: "client@democlient.com",
      name: "Client User",
      passwordHash: clientPassword,
      role: "CLIENT",
      clientId: client.id,
      mustChangePassword: forceDemoPasswordChange,
    },
  });

  const otherClientPassword = await hash("other123", 12);
  const otherClient = await prisma.client.upsert({
    where: { slug: "other-co" },
    update: {
      status: "LEAD_QUALIFIED",
      country: "IT",
    },
    create: {
      companyName: "Other Co",
      slug: "other-co",
      contactEmail: "contact@otherco.com",
      status: "LEAD_QUALIFIED",
      country: "IT",
    },
  });

  const otherClientUser = await prisma.user.upsert({
    where: { email: "other@otherco.com" },
    update: {
      ...demoPasswordFlags,
      passwordHash: otherClientPassword,
      role: "CLIENT",
      clientId: otherClient.id,
    },
    create: {
      email: "other@otherco.com",
      name: "Other Client User",
      passwordHash: otherClientPassword,
      role: "CLIENT",
      clientId: otherClient.id,
      mustChangePassword: forceDemoPasswordChange,
    },
  });

  console.log("Seed complete:");
  console.log("  Admin:", admin.email, "(password: admin123)");
  console.log("  Client user:", clientUser.email, "(password: client123)");
  console.log("  Client:", client.companyName, "slug:", client.slug);
  console.log("  Other client user:", otherClientUser.email, "(password: other123)");
  console.log("  Other client:", otherClient.companyName, "slug:", otherClient.slug);

  await prisma.flowTask.upsert({
    where: { id: SEED_FLOW_TASK_ALPHA },
    update: {
      title: "Follow-up commerciale (demo)",
      description: "Esempio task Onizuka Flow collegato a un cliente.",
      status: "TODO",
      priority: "HIGH",
      source: "manual",
      relatedClientId: client.id,
      ownerUserId: admin.id,
    },
    create: {
      id: SEED_FLOW_TASK_ALPHA,
      title: "Follow-up commerciale (demo)",
      description: "Esempio task Onizuka Flow collegato a un cliente.",
      status: "TODO",
      priority: "HIGH",
      source: "manual",
      relatedClientId: client.id,
      ownerUserId: admin.id,
    },
  });

  await prisma.flowTask.upsert({
    where: { id: SEED_FLOW_TASK_BETA },
    update: {
      title: "Recap settimanale pipeline",
      description: "Task senza cliente collegato.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      source: "manual",
      relatedClientId: null,
      ownerUserId: admin.id,
    },
    create: {
      id: SEED_FLOW_TASK_BETA,
      title: "Recap settimanale pipeline",
      description: "Task senza cliente collegato.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      source: "manual",
      ownerUserId: admin.id,
    },
  });

  await prisma.memoryItem.upsert({
    where: { id: SEED_MEMORY_DEMO_CLIENT },
    update: {
      title: "Preferenze cliente demo",
      content:
        "Il cliente demo preferisce email per gli aggiornamenti. Usare tono consultivo nelle proposte commerciali.",
      scope: "CLIENT",
      sensitivity: "LOW",
      source: "MANUAL",
      tags: ["demo", "comunicazione"],
      relatedClientId: client.id,
      relatedAssetId: null,
      ownerUserId: admin.id,
    },
    create: {
      id: SEED_MEMORY_DEMO_CLIENT,
      title: "Preferenze cliente demo",
      content:
        "Il cliente demo preferisce email per gli aggiornamenti. Usare tono consultivo nelle proposte commerciali.",
      scope: "CLIENT",
      sensitivity: "LOW",
      source: "MANUAL",
      tags: ["demo", "comunicazione"],
      relatedClientId: client.id,
      ownerUserId: admin.id,
    },
  });

  await prisma.asset.upsert({
    where: { id: SEED_ASSET_DEMO },
    update: {
      clientId: client.id,
      name: "LabSeven — brand principale",
      slug: "labseven",
      platform: "FACEBOOK",
      notes: "Asset seed per opportunità demo e catalogo CRM.",
    },
    create: {
      id: SEED_ASSET_DEMO,
      clientId: client.id,
      name: "LabSeven — brand principale",
      slug: "labseven",
      platform: "FACEBOOK",
      notes: "Asset seed per opportunità demo e catalogo CRM.",
    },
  });

  await prisma.lead.upsert({
    where: { id: SEED_LEAD_DEMO },
    update: {
      title: "Lead demo — contatto sito",
      contactName: "Mario Rossi",
      businessName: "Rossi Impianti (prospect)",
      email: "mario.rossi@example.com",
      phone: "+39 333 0000000",
      vatNumber: null,
      source: "sito web",
      status: "QUALIFIED",
      notes: "Interessato a restyling sito.",
      ownerUserId: admin.id,
      convertedClientId: null,
    },
    create: {
      id: SEED_LEAD_DEMO,
      title: "Lead demo — contatto sito",
      contactName: "Mario Rossi",
      businessName: "Rossi Impianti (prospect)",
      email: "mario.rossi@example.com",
      phone: "+39 333 0000000",
      source: "sito web",
      status: "QUALIFIED",
      notes: "Interessato a restyling sito.",
      ownerUserId: admin.id,
    },
  });

  await prisma.opportunity.upsert({
    where: { id: SEED_OPPORTUNITY_DEMO },
    update: {
      clientId: client.id,
      assetId: SEED_ASSET_DEMO,
      title: "Restyling sito web",
      description: "Progetto sito nuovo per cliente demo.",
      status: "OPEN",
      priority: "HIGH",
      estimatedValue: new Prisma.Decimal("4500.00"),
      probability: 40,
      nextAction: "Inviare proposta economica",
      dueDate: null,
      ownerUserId: admin.id,
    },
    create: {
      id: SEED_OPPORTUNITY_DEMO,
      clientId: client.id,
      assetId: SEED_ASSET_DEMO,
      title: "Restyling sito web",
      description: "Progetto sito nuovo per cliente demo.",
      status: "OPEN",
      priority: "HIGH",
      estimatedValue: new Prisma.Decimal("4500.00"),
      probability: 40,
      nextAction: "Inviare proposta economica",
      ownerUserId: admin.id,
    },
  });

  await prisma.clientContact.upsert({
    where: { id: SEED_CONTACT_DEMO },
    update: {
      clientId: client.id,
      name: "Laura Bianchi",
      role: "Responsabile marketing",
      email: "laura.bianchi@democlient.com",
      phone: "+39 02 1234567",
      isPrimary: true,
    },
    create: {
      id: SEED_CONTACT_DEMO,
      clientId: client.id,
      name: "Laura Bianchi",
      role: "Responsabile marketing",
      email: "laura.bianchi@democlient.com",
      phone: "+39 02 1234567",
      isPrimary: true,
    },
  });

  await prisma.postItem.upsert({
    where: { id: SEED_DEMO_APPROVED_POST_ID },
    update: {
      status: "APPROVED",
      captionText: "Seed APPROVED for n8n E2E",
      publishedAt: null,
      externalRef: null,
    },
    create: {
      id: SEED_DEMO_APPROVED_POST_ID,
      clientId: client.id,
      platform: "FACEBOOK",
      captionText: "Seed APPROVED for n8n E2E",
      status: "APPROVED",
      createdByUserId: admin.id,
      media: {
        create: {
          type: "IMAGE",
          url: "https://example.com/e2e-seed-approved.png",
          filename: "e2e-seed-approved.png",
          mimeType: "image/png",
          sizeBytes: 68,
        },
      },
    },
  });

  await prisma.postItem.upsert({
    where: { id: SEED_DEMO_PENDING_POST_ID },
    update: {
      status: "PENDING",
      captionText: "Seed PENDING for approve E2E",
    },
    create: {
      id: SEED_DEMO_PENDING_POST_ID,
      clientId: client.id,
      platform: "INSTAGRAM",
      captionText: "Seed PENDING for approve E2E",
      status: "PENDING",
      createdByUserId: admin.id,
      media: {
        create: {
          type: "IMAGE",
          url: "https://example.com/e2e-seed-pending.png",
          filename: "e2e-seed-pending.png",
          mimeType: "image/png",
          sizeBytes: 68,
        },
      },
    },
  });

  const seedTicket = await prisma.clientTicket.upsert({
    where: { id: "seed-ticket-demo" },
    update: { status: "IN_PROGRESS" },
    create: {
      id: "seed-ticket-demo",
      clientId: client.id,
      title: "Seed ticket demo",
      body: "Richiesta di test dal seed Onizuka.",
      status: "OPEN",
      createdByUserId: clientUser.id,
    },
  });

  const hasTicketUpdate = await prisma.clientTicketUpdate.findFirst({
    where: { ticketId: seedTicket.id },
  });
  if (!hasTicketUpdate) {
    await prisma.clientTicketUpdate.create({
      data: {
        ticketId: seedTicket.id,
        status: "IN_PROGRESS",
        message: "Il team sta lavorando alla richiesta (seed).",
        createdByUserId: admin.id,
      },
    });
  }

  const existingDraft = await prisma.outreachDraft.findFirst({
    where: { ownerUserId: admin.id, subject: "Seed outreach demo" },
  });
  if (!existingDraft) {
    await prisma.outreachDraft.create({
      data: {
        ownerUserId: admin.id,
        clientId: client.id,
        subject: "Seed outreach demo",
        body: "Bozza email di esempio per Reach MVP.",
        status: "DRAFT",
      },
    });
  }

  const existingQuote = await prisma.opportunityQuote.findFirst({
    where: { opportunityId: SEED_OPPORTUNITY_DEMO },
  });
  if (!existingQuote) {
    await prisma.opportunityQuote.create({
      data: {
        opportunityId: SEED_OPPORTUNITY_DEMO,
        ownerUserId: admin.id,
        title: "Preventivo seed demo",
        status: "DRAFT",
        taxPercent: 22,
        linesJson: JSON.stringify([
          { description: "Gestione social mensile", quantity: 1, unitPrice: 1500 },
          { description: "Setup iniziale", quantity: 1, unitPrice: 500 },
        ]),
        notes: "Preventivo dimostrativo Onizuka.",
      },
    });
  }

  const catalog = await seedCommercialCatalog();
  console.log("  Commercial catalog:", catalog.brands, "brands,", catalog.services, "services");

  console.log("  E2E seed posts:", SEED_DEMO_APPROVED_POST_ID, SEED_DEMO_PENDING_POST_ID);
  console.log("  Flow seed tasks:", SEED_FLOW_TASK_ALPHA, SEED_FLOW_TASK_BETA);
  console.log("  Memory seed:", SEED_MEMORY_DEMO_CLIENT);
  console.log(
    "  CRM seed lead/asset/opportunity/contact:",
    SEED_LEAD_DEMO,
    SEED_ASSET_DEMO,
    SEED_OPPORTUNITY_DEMO,
    SEED_CONTACT_DEMO
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
