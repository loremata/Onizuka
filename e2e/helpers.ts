import type { Page } from "@playwright/test";

/** `YYYY-MM-DD` del giorno civile corrente nel fuso IANA (es. per `datetime-local`). */
export function calendarDatePrefixInTimeZone(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function loginAsAdmin(page: Page) {
  const csrfRes = await page.request.get("/api/auth/csrf");
  if (!csrfRes.ok()) {
    throw new Error(`CSRF non disponibile: ${csrfRes.status()}`);
  }
  const csrf = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrf.csrfToken) {
    throw new Error("csrfToken mancante da /api/auth/csrf");
  }

  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email: "admin@agency.com",
    password: "admin123",
    callbackUrl: "/admin",
    json: "true",
  });

  const loginRes = await page.request.post("/api/auth/callback/credentials", {
    form: Object.fromEntries(body.entries()),
  });
  if (!loginRes.ok()) {
    throw new Error(`Login callback fallito: ${loginRes.status()}`);
  }

  await page.goto("/admin");
  await page.waitForURL(/\/admin/, { timeout: 45_000 });
}

export async function loginAsDemoClient(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("client@democlient.com");
  await page.getByLabel("Password").fill("client123");
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

export async function loginAsOtherClient(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("other@otherco.com");
  await page.getByLabel("Password").fill("other123");
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.waitForURL(/\/app/, { timeout: 20_000 });
}
