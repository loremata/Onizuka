#!/usr/bin/env node
/**
 * Smoke test HTTP dopo deploy. Uso:
 *   BASE_URL=https://onizuka.it node scripts/smoke-production.mjs
 *   BASE_URL=https://onizuka.it CRON_SECRET=xxx node scripts/smoke-production.mjs
 */

const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET?.trim();

const checks = [];

async function get(path) {
  const res = await fetch(`${base}${path}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function getHtml(path) {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, ok: res.ok };
}

async function cronGet(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${cronSecret}` },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  console.log(`Smoke ${base}\n`);

  const health = await get("/api/health");
  checks.push({
    name: "GET /api/health",
    ok: health.status === 200 && health.json.ok,
    detail: `${health.status}`,
  });

  const ready = await get("/api/health/ready");
  checks.push({
    name: "GET /api/health/ready",
    ok: ready.status === 200 && ready.json.database === "ok",
    detail: ready.json.capabilities ? JSON.stringify(ready.json.capabilities) : `${ready.status}`,
  });

  const publicRoutes = [
    "/walkin",
    "/status",
    "/login",
    "/robots.txt",
    "/.well-known/security.txt",
  ];
  for (const path of publicRoutes) {
    const r = await getHtml(path);
    checks.push({
      name: `GET ${path}`,
      ok: r.status === 200,
      detail: `${r.status}`,
    });
  }

  if (cronSecret) {
    for (const path of [
      "/api/cron/notifications",
      "/api/cron/webhook-retry",
      "/api/cron/reach-sequences",
    ]) {
      const cron = await cronGet(path);
      checks.push({
        name: `GET ${path}`,
        ok: cron.status === 200 && cron.json.ok,
        detail: `${cron.status}`,
      });
    }
  } else {
    console.log("  (skip cron: imposta CRON_SECRET)\n");
  }

  let failed = 0;
  for (const c of checks) {
    console.log(c.ok ? `  ✓ ${c.name}` : `  ✗ ${c.name}`, c.detail ?? "");
    if (!c.ok) failed += 1;
  }

  console.log(failed ? `\n${failed} check falliti\n` : "\nTutti i check passati\n");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
