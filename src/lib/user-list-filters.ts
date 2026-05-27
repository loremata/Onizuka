import type { Prisma, Role } from "@prisma/client";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;

const ROLES: Role[] = ["ADMIN", "CLIENT"];

export type UserListFilters = {
  q: string;
  role: Role | null;
};

export function parseUserListFilters(
  searchParams: Record<string, string | string[] | undefined>
): UserListFilters {
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);
  const roleRaw = normalizeQueryParam(searchParams.role);
  const role = ROLES.includes(roleRaw as Role) ? (roleRaw as Role) : null;
  return { q, role };
}

export function buildUserSearchWhere(f: UserListFilters): Prisma.UserWhereInput {
  const mode = "insensitive" as const;
  return {
    ...(f.role ? { role: f.role } : {}),
    ...(f.q
      ? {
          OR: [
            { email: { contains: f.q, mode } },
            { name: { contains: f.q, mode } },
            { client: { is: { companyName: { contains: f.q, mode } } } },
            { client: { is: { slug: { contains: f.q, mode } } } },
          ],
        }
      : {}),
  };
}
