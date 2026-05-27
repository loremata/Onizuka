import { prisma } from "@/lib/prisma";
import { normalizeFiscalCode } from "@/lib/fiscal-normalize";
import { assertPersonFiscalUnique } from "@/lib/person-fiscal-identity";

export type PersonListRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyCount: number;
  primaryCompany: string | null;
};

export async function listPeople(ownerUserId: string, q?: string, limit = 100): Promise<PersonListRow[]> {
  const needle = q?.trim().toLowerCase();
  const people = await prisma.person.findMany({
    where: { ownerUserId },
    orderBy: { updatedAt: "desc" },
    take: needle ? 300 : limit,
    include: {
      clientRoles: {
        include: { client: { select: { companyName: true } } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  const filtered = needle
    ? people.filter((p) => {
        const hay = [p.fullName, p.email, p.phone, p.fiscalCode, ...p.clientRoles.map((r) => r.client.companyName)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
    : people;

  return filtered.slice(0, limit).map((p) => ({
    id: p.id,
    fullName: p.fullName,
    email: p.email,
    phone: p.phone,
    companyCount: p.clientRoles.length,
    primaryCompany:
      p.clientRoles.find((r) => r.isPrimary)?.client.companyName ??
      p.clientRoles[0]?.client.companyName ??
      null,
  }));
}

export async function loadPersonDetail(personId: string, ownerUserId: string) {
  return prisma.person.findFirst({
    where: { id: personId, ownerUserId },
    include: {
      clientRoles: {
        include: { client: { select: { id: true, companyName: true, kind: true, status: true } } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });
}

/** Allinea Person + PersonClientRole da un ClientContact (stesso nome/email su scheda). */
/** Aggiorna CF persona con controllo univocità (app-level). */
export async function updatePersonFiscalCode(params: {
  ownerUserId: string;
  personId: string;
  fiscalCode?: string | null;
}): Promise<{ error: string } | { ok: true }> {
  const fiscalCode = normalizeFiscalCode(params.fiscalCode);
  const conflict = await assertPersonFiscalUnique({
    ownerUserId: params.ownerUserId,
    fiscalCode,
    excludePersonId: params.personId,
  });
  if (conflict) return { error: conflict.error };
  await prisma.person.update({
    where: { id: params.personId },
    data: { fiscalCode },
  });
  return { ok: true };
}

export async function syncPersonFromClientContact(params: {
  ownerUserId: string;
  clientId: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  fiscalCode?: string | null;
  isPrimary?: boolean;
}): Promise<string> {
  const emailNorm = params.email?.trim().toLowerCase() || null;

  let person = emailNorm
    ? await prisma.person.findFirst({
        where: { ownerUserId: params.ownerUserId, email: { equals: emailNorm, mode: "insensitive" } },
      })
    : null;

  if (!person) {
    person = await prisma.person.findFirst({
      where: {
        ownerUserId: params.ownerUserId,
        fullName: { equals: params.name.trim(), mode: "insensitive" },
        clientRoles: { some: { clientId: params.clientId } },
      },
    });
  }

  const hasFiscalInput = params.fiscalCode !== undefined && params.fiscalCode !== null;
  const fiscalCode = hasFiscalInput ? normalizeFiscalCode(params.fiscalCode) : undefined;

  if (!person) {
    if (fiscalCode) {
      const conflict = await assertPersonFiscalUnique({
        ownerUserId: params.ownerUserId,
        fiscalCode,
      });
      if (conflict) throw new Error(conflict.error);
    }
    person = await prisma.person.create({
      data: {
        ownerUserId: params.ownerUserId,
        fullName: params.name.trim(),
        email: params.email?.trim() || null,
        phone: params.phone?.trim() || null,
        ...(fiscalCode ? { fiscalCode } : {}),
      },
    });
  } else {
    if (fiscalCode) {
      const conflict = await assertPersonFiscalUnique({
        ownerUserId: params.ownerUserId,
        fiscalCode,
        excludePersonId: person.id,
      });
      if (conflict) throw new Error(conflict.error);
    }
    person = await prisma.person.update({
      where: { id: person.id },
      data: {
        fullName: params.name.trim(),
        email: params.email?.trim() || person.email,
        phone: params.phone?.trim() || person.phone,
        ...(hasFiscalInput ? { fiscalCode: fiscalCode ?? null } : {}),
      },
    });
  }

  if (params.isPrimary) {
    await prisma.personClientRole.updateMany({
      where: { clientId: params.clientId },
      data: { isPrimary: false },
    });
  }

  await prisma.personClientRole.upsert({
    where: {
      personId_clientId: { personId: person.id, clientId: params.clientId },
    },
    create: {
      personId: person.id,
      clientId: params.clientId,
      role: params.role?.trim() || null,
      isPrimary: params.isPrimary ?? false,
    },
    update: {
      role: params.role?.trim() || null,
      isPrimary: params.isPrimary ?? false,
    },
  });

  return person.id;
}
