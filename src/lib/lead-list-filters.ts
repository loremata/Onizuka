import type { LeadStatus, Prisma } from "@prisma/client";
import { leadStatusOptions } from "@/lib/crm-lead-status";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;

export type LeadListFilters = {
  status: LeadStatus | null;
  q: string;
  referrerId: string | null;
};

export function parseLeadListFilters(
  searchParams: Record<string, string | string[] | undefined>
): LeadListFilters {
  const statusRaw = normalizeQueryParam(searchParams.status);
  const status = leadStatusOptions.includes(statusRaw as LeadStatus) ? (statusRaw as LeadStatus) : null;
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);
  const refRaw = normalizeQueryParam(searchParams.referrerId);
  const referrerId = refRaw.length > 0 ? refRaw : null;
  return { status, q, referrerId };
}

export function buildOwnedLeadWhere(ownerUserId: string, f: LeadListFilters): Prisma.LeadWhereInput {
  return {
    ownerUserId,
    ...(f.status ? { status: f.status } : {}),
    ...(f.referrerId ? { referrerId: f.referrerId } : {}),
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode: "insensitive" } },
            { businessName: { contains: f.q, mode: "insensitive" } },
            { contactName: { contains: f.q, mode: "insensitive" } },
            { email: { contains: f.q, mode: "insensitive" } },
            { phone: { contains: f.q, mode: "insensitive" } },
            { notes: { contains: f.q, mode: "insensitive" } },
            { source: { contains: f.q, mode: "insensitive" } },
            { vatNumber: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
