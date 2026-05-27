import { prisma } from "@/lib/prisma";
import { addBusinessDays } from "@/lib/business-days";
import type { AuditMatchKind } from "@/lib/audit-commercial-match";

export { addBusinessDays } from "@/lib/business-days";

async function hasAuditTask(params: {
  ownerUserId: string;
  clientId: string;
  auditId: string;
  titleContains: string;
}): Promise<boolean> {
  const existing = await prisma.flowTask.findFirst({
    where: {
      ownerUserId: params.ownerUserId,
      relatedClientId: params.clientId,
      source: "audit",
      status: { not: "DONE" },
      title: { contains: params.titleContains, mode: "insensitive" },
      description: { contains: params.auditId },
    },
  });
  return Boolean(existing);
}

export async function createAuditFollowUpTasks(params: {
  ownerUserId: string;
  clientId: string;
  clientName: string;
  auditId: string;
  outreachDraftId?: string;
  priorityProblem?: string | null;
  recommendedOffer?: string | null;
  opportunityId?: string;
  contactDue?: Date;
  matchKind?: AuditMatchKind;
}): Promise<string[]> {
  const ids: string[] = [];
  const contactDue = params.contactDue ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  })();

  if (params.outreachDraftId) {
    if (
      !(await hasAuditTask({
        ownerUserId: params.ownerUserId,
        clientId: params.clientId,
        auditId: params.auditId,
        titleContains: "Approva email Reach",
      }))
    ) {
      const t = await prisma.flowTask.create({
        data: {
          ownerUserId: params.ownerUserId,
          relatedClientId: params.clientId,
          title: `Approva email Reach — ${params.clientName}`,
          description: `Bozza collegata all'audit ${params.auditId}. Approva e invia da /admin/approvals o Reach.`,
          status: "TODO",
          priority: "HIGH",
          dueDate: contactDue,
          source: "audit",
        },
      });
      ids.push(t.id);
    }

    const verifySentDue = addBusinessDays(new Date(), 1);
    if (
      !(await hasAuditTask({
        ownerUserId: params.ownerUserId,
        clientId: params.clientId,
        auditId: params.auditId,
        titleContains: "Verifica invio 1ª email",
      }))
    ) {
      const tVerify = await prisma.flowTask.create({
        data: {
          ownerUserId: params.ownerUserId,
          relatedClientId: params.clientId,
          title: `Verifica invio 1ª email post-audit — ${params.clientName}`,
          description: `Controlla che la bozza Reach sia stata inviata (SMTP/mailto). Audit: ${params.auditId}`,
          status: "TODO",
          priority: "HIGH",
          dueDate: verifySentDue,
          source: "audit",
        },
      });
      ids.push(tVerify.id);
    }
  } else if (
    !(await hasAuditTask({
      ownerUserId: params.ownerUserId,
      clientId: params.clientId,
      auditId: params.auditId,
      titleContains: "Contatto entro",
    }))
  ) {
    const tContact = await prisma.flowTask.create({
      data: {
        ownerUserId: params.ownerUserId,
        relatedClientId: params.clientId,
        title: `Contatto entro 24–48h post-audit — ${params.clientName}`,
        description: `Priorità commerciale da audit ${params.auditId}. ${params.priorityProblem ?? ""}`,
        status: "TODO",
        priority: "HIGH",
        dueDate: contactDue,
        source: "audit",
      },
    });
    ids.push(tContact.id);
  }

  if (params.matchKind === "possible_duplicate") {
    if (
      !(await hasAuditTask({
        ownerUserId: params.ownerUserId,
        clientId: params.clientId,
        auditId: params.auditId,
        titleContains: "Revisione duplicato",
      }))
    ) {
      const tDup = await prisma.flowTask.create({
        data: {
          ownerUserId: params.ownerUserId,
          relatedClientId: params.clientId,
          title: `Revisione duplicato prospect — ${params.clientName}`,
          description: `Match debole su ragione sociale/dominio. Verifica scheda CRM. Audit: ${params.auditId}`,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: addBusinessDays(new Date(), 2),
          source: "audit",
        },
      });
      ids.push(tDup.id);
    }
  }

  if (params.opportunityId) {
    if (
      !(await hasAuditTask({
        ownerUserId: params.ownerUserId,
        clientId: params.clientId,
        auditId: params.auditId,
        titleContains: "Follow-up opportunity",
      }))
    ) {
      const tOpp = await prisma.flowTask.create({
        data: {
          ownerUserId: params.ownerUserId,
          relatedClientId: params.clientId,
          title: `Follow-up opportunity post-audit — ${params.clientName}`,
          description: `Opportunity ${params.opportunityId} · audit ${params.auditId}`,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: addBusinessDays(new Date(), 3),
          source: "audit",
        },
      });
      ids.push(tOpp.id);
    }
  }

  const followUpDue = addBusinessDays(new Date(), 5);
  const problem = params.priorityProblem?.trim();
  const offer = params.recommendedOffer?.trim();

  if (
    !(await hasAuditTask({
      ownerUserId: params.ownerUserId,
      clientId: params.clientId,
      auditId: params.auditId,
      titleContains: "Follow-up commerciale post-audit",
    }))
  ) {
    const t2 = await prisma.flowTask.create({
      data: {
        ownerUserId: params.ownerUserId,
        relatedClientId: params.clientId,
        title: `Follow-up commerciale post-audit — ${params.clientName}`,
        description: [
          problem ? `Problema prioritario: ${problem}` : null,
          offer ? `Offerta consigliata: ${offer}` : null,
          `Audit: /admin/audit/digital/${params.auditId}`,
        ]
          .filter(Boolean)
          .join("\n"),
        status: "TODO",
        priority: params.outreachDraftId ? "MEDIUM" : "HIGH",
        dueDate: followUpDue,
        source: "audit",
      },
    });
    ids.push(t2.id);
  }

  return ids;
}
