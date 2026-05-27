export type ReachListFilters = {
  clientId: string | null;
};

export function parseReachListFilters(
  searchParams: Record<string, string | string[] | undefined>
): ReachListFilters {
  const raw = searchParams.clientId;
  const clientId = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  return { clientId };
}
