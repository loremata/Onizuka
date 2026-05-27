import type { Platform, PostStatus, Prisma } from "@prisma/client";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "GBP"];
const STATUSES: PostStatus[] = ["PENDING", "APPROVED", "NEEDS_REVISION"];

export type PostListFilters = {
  q: string;
  clientId: string;
  platform: Platform | null;
  status: PostStatus | null;
};

export function parsePostListFilters(
  searchParams: Record<string, string | string[] | undefined>
): PostListFilters {
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);
  const clientId = normalizeQueryParam(searchParams.clientId);
  const platformRaw = normalizeQueryParam(searchParams.platform);
  const platform = PLATFORMS.includes(platformRaw as Platform) ? (platformRaw as Platform) : null;
  const statusRaw = normalizeQueryParam(searchParams.status);
  const status = STATUSES.includes(statusRaw as PostStatus) ? (statusRaw as PostStatus) : null;
  return { q, clientId, platform, status };
}

export function buildPostListWhere(f: PostListFilters): Prisma.PostItemWhereInput {
  const mode = "insensitive" as const;
  return {
    ...(f.clientId ? { clientId: f.clientId } : {}),
    ...(f.platform ? { platform: f.platform } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.q
      ? {
          OR: [
            { captionText: { contains: f.q, mode } },
            { externalRef: { contains: f.q, mode } },
            { client: { is: { companyName: { contains: f.q, mode } } } },
            { client: { is: { slug: { contains: f.q, mode } } } },
          ],
        }
      : {}),
  };
}
