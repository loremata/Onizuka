import type { LeadStatus, CommercialProspectStage, Prisma } from "@prisma/client";
import { CommercialProspectStage as StageEnum } from "@prisma/client";
import { leadStatusOptions } from "@/lib/crm-lead-status";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;
export const LEADS_PAGE_SIZE = 50;

export type LeadListFilters = {
  status: LeadStatus | null;
  stage: CommercialProspectStage | null;
  q: string;
  referrerId: string | null;
  source: string | null; // sottostringa (es. "scraping" o un comune)
  city: string | null;
  hasWebsite: boolean | null; // true = ha sito, false = senza sito
  page: number;
};

const stageValues = Object.values(StageEnum) as CommercialProspectStage[];

export function parseLeadListFilters(
  searchParams: Record<string, string | string[] | undefined>
): LeadListFilters {
  const statusRaw = normalizeQueryParam(searchParams.status);
  const status = leadStatusOptions.includes(statusRaw as LeadStatus) ? (statusRaw as LeadStatus) : null;

  const stageRaw = normalizeQueryParam(searchParams.stage);
  const stage = stageValues.includes(stageRaw as CommercialProspectStage)
    ? (stageRaw as CommercialProspectStage)
    : null;

  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);

  const refRaw = normalizeQueryParam(searchParams.referrerId);
  const referrerId = refRaw.length > 0 ? refRaw : null;

  const sourceRaw = normalizeQueryParam(searchParams.source);
  const source = sourceRaw.length > 0 ? sourceRaw.slice(0, Q_MAX) : null;

  const cityRaw = normalizeQueryParam(searchParams.city);
  const city = cityRaw.length > 0 ? cityRaw.slice(0, Q_MAX) : null;

  const hasWebRaw = normalizeQueryParam(searchParams.hasWebsite).toLowerCase();
  const hasWebsite = hasWebRaw === "si" || hasWebRaw === "true" ? true
    : hasWebRaw === "no" || hasWebRaw === "false" ? false
    : null;

  const pageRaw = parseInt(normalizeQueryParam(searchParams.page), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return { status, stage, q, referrerId, source, city, hasWebsite, page };
}

export function buildOwnedLeadWhere(ownerUserId: string, f: LeadListFilters): Prisma.LeadWhereInput {
  return {
    ownerUserId,
    ...(f.status ? { status: f.status } : {}),
    ...(f.stage ? { commercialProspectStage: f.stage } : {}),
    ...(f.referrerId ? { referrerId: f.referrerId } : {}),
    ...(f.source ? { source: { contains: f.source, mode: "insensitive" } } : {}),
    ...(f.city ? { city: { contains: f.city, mode: "insensitive" } } : {}),
    ...(f.hasWebsite === true ? { website: { not: null } } : {}),
    ...(f.hasWebsite === false ? { OR: [{ website: null }, { website: "" }] } : {}),
    ...(f.q
      ? {
          AND: [
            {
              OR: [
                { title: { contains: f.q, mode: "insensitive" } },
                { businessName: { contains: f.q, mode: "insensitive" } },
                { contactName: { contains: f.q, mode: "insensitive" } },
                { email: { contains: f.q, mode: "insensitive" } },
                { phone: { contains: f.q, mode: "insensitive" } },
                { notes: { contains: f.q, mode: "insensitive" } },
                { source: { contains: f.q, mode: "insensitive" } },
                { vatNumber: { contains: f.q, mode: "insensitive" } },
                { city: { contains: f.q, mode: "insensitive" } },
              ],
            },
          ],
        }
      : {}),
  };
}
