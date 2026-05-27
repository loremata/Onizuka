/**
 * Worker Kubernetes: polling coda automazioni Onizuka.
 * Env: ONIZUKA_APP_URL, CRON_SECRET, AUTOMATION_WORKER_INTERVAL_MS (default 5000)
 */
const base = (process.env.ONIZUKA_APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim();
const intervalMs = Number(process.env.AUTOMATION_WORKER_INTERVAL_MS || 5000);
const batch = Number(process.env.AUTOMATION_WORKER_BATCH || 30);

if (!base || !secret) {
  console.error("ONIZUKA_APP_URL e CRON_SECRET obbligatori.");
  process.exit(1);
}

async function tick() {
  const url = `${base}/api/cron/automation-queue?limit=${batch}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${secret}`, "x-cron-secret": secret },
  });
  const text = await res.text();
  console.log(new Date().toISOString(), res.status, text.slice(0, 500));
}

console.log(`Automation worker → ${base} every ${intervalMs}ms`);
await tick();
setInterval(tick, intervalMs);
