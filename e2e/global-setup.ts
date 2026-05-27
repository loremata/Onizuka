import { request } from "@playwright/test";
import { spawnSync } from "node:child_process";

const base = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function isRemoteBase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host !== "localhost" && host !== "127.0.0.1";
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  if (isRemoteBase(base)) {
    const { assertSafeE2EBaseUrl } = await import("../src/lib/staging-guard");
    assertSafeE2EBaseUrl(base);
    console.log(`E2E remoto: ${base} (seed locale saltato — usa npm run staging:seed sul DB staging).`);
  } else if (process.env.PLAYWRIGHT_SKIP_SEED !== "1") {
    const seed = spawnSync("npm", ["run", "db:seed:e2e"], {
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    if (seed.status !== 0) {
      throw new Error("Seed E2E fallito (npm run db:seed:e2e).");
    }
  }

  const ctx = await request.newContext();
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const res = await ctx.get(`${base}/api/health`, { timeout: 10_000 });
      if (res.ok()) {
        await ctx.dispose();
        return;
      }
    } catch {
      // server non pronto
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  await ctx.dispose();
  throw new Error(
    `Server non raggiungibile su ${base}. Avvia: npm run dev (locale) o verifica deploy staging (PLAYWRIGHT_BASE_URL).`
  );
}
