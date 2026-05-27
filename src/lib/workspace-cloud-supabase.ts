function supabaseApiToken(): string | null {
  return process.env.SUPABASE_ACCESS_TOKEN?.trim() || null;
}

export function isSupabaseCloudProvisionEnabled(): boolean {
  return !!(supabaseApiToken() && process.env.SUPABASE_ORG_ID?.trim());
}

function poolerUrlFromTemplate(ref: string, password: string): string {
  const tpl =
    process.env.ONIZUKA_SUPABASE_POOLER_TEMPLATE?.trim() ||
    "postgresql://postgres.{ref}:{password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
  return tpl.replace(/\{ref\}/g, ref).replace(/\{password\}/g, encodeURIComponent(password));
}

async function waitProjectHealthy(ref: string, maxMs = 300_000): Promise<{ ok: true } | { error: string }> {
  const token = supabaseApiToken();
  if (!token) return { error: "Token Supabase mancante." };
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { error: `Poll progetto: ${res.status} ${(await res.text()).slice(0, 400)}` };
    }
    const data = (await res.json()) as { status?: string };
    const st = (data.status ?? "").toUpperCase();
    if (st.includes("ACTIVE") || st === "HEALTHY" || st === "ACTIVE_HEALTHY") {
      return { ok: true };
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  return { error: "Timeout attesa progetto Supabase ACTIVE." };
}

export async function createSupabaseTenantProject(params: {
  name: string;
  dbPassword: string;
  region?: string;
}): Promise<{ ref: string; databaseUrl: string } | { error: string }> {
  const token = supabaseApiToken();
  const orgId = process.env.SUPABASE_ORG_ID?.trim();
  if (!token || !orgId) {
    return { error: "Configura SUPABASE_ACCESS_TOKEN e SUPABASE_ORG_ID." };
  }

  const { assertCanCreateSupabaseProject } = await import("@/lib/supabase-org-limits");
  const limitCheck = await assertCanCreateSupabaseProject();
  if ("error" in limitCheck) return limitCheck;

  const region = params.region ?? process.env.SUPABASE_REGION?.trim() ?? "eu-central-1";
  const res = await fetch("https://api.supabase.com/v1/projects", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organization_id: orgId,
      name: params.name.slice(0, 48),
      region,
      db_pass: params.dbPassword,
      plan: "free",
    }),
  });

  if (!res.ok) {
    return { error: `Create project: ${res.status} ${(await res.text()).slice(0, 800)}` };
  }

  const data = (await res.json()) as { id?: string; ref?: string };
  const ref = data.ref ?? data.id;
  if (!ref) return { error: "Risposta Supabase senza project ref." };

  const healthy = await waitProjectHealthy(ref);
  if ("error" in healthy) return healthy;

  return { ref, databaseUrl: poolerUrlFromTemplate(ref, params.dbPassword) };
}
