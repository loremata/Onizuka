function supabaseApiToken(): string | null {
  return process.env.SUPABASE_ACCESS_TOKEN?.trim() || null;
}

export function supabaseMaxActiveProjects(): number {
  const n = Number(process.env.SUPABASE_MAX_ACTIVE_PROJECTS ?? "10");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

export async function countSupabaseOrgProjects(): Promise<
  { count: number } | { error: string }
> {
  const token = supabaseApiToken();
  const orgId = process.env.SUPABASE_ORG_ID?.trim();
  if (!token || !orgId) return { error: "SUPABASE_ACCESS_TOKEN o SUPABASE_ORG_ID mancanti." };

  const res = await fetch(`https://api.supabase.com/v1/projects?organization_id=${orgId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return { error: `List projects: ${res.status} ${(await res.text()).slice(0, 400)}` };
  }
  const data = (await res.json()) as unknown;
  const list = Array.isArray(data) ? data : [];
  const active = list.filter((p) => {
    const st = String((p as { status?: string }).status ?? "").toUpperCase();
    return !st.includes("INACTIVE") && !st.includes("DELETED");
  });
  return { count: active.length };
}

export async function assertCanCreateSupabaseProject(): Promise<{ ok: true } | { error: string }> {
  const counted = await countSupabaseOrgProjects();
  if ("error" in counted) return counted;
  const max = supabaseMaxActiveProjects();
  if (counted.count >= max) {
    return {
      error: `Limite progetti Supabase org (${counted.count}/${max}). Aumenta SUPABASE_MAX_ACTIVE_PROJECTS o elimina progetti inattivi.`,
    };
  }
  return { ok: true };
}
