/**
 * Catalogo allineato a PASSI-MANCANTI.md (numeri 1–30).
 * Usato da script CLI e documentazione; la logica live resta in go-live-missing-steps.ts.
 */

export type PassiMancantiCategory = "required" | "recommended" | "optional";

export type PassiMancantiStepDef = {
  num: number;
  id: string;
  category: PassiMancantiCategory;
  label: string;
  /** repo = verificabile in codebase/CI; ops = solo deploy/manuale */
  kind: "repo" | "ops";
  hint?: string;
};

export const PASSI_MANCANTI_CATALOG: PassiMancantiStepDef[] = [
  { num: 1, id: "git-push", category: "required", kind: "ops", label: "Repository GitHub aggiornato" },
  { num: 2, id: "supabase-r2", category: "required", kind: "ops", label: "Progetto Supabase (EU) + bucket R2" },
  { num: 3, id: "database-url", category: "required", kind: "ops", label: "DATABASE_URL (pooler 6543) su Vercel", hint: "npm run deploy:check" },
  { num: 4, id: "direct-url", category: "required", kind: "ops", label: "DIRECT_URL (5432) per migrate deploy" },
  { num: 5, id: "migrate-deploy", category: "required", kind: "ops", label: "prisma migrate deploy (batch F incluso)", hint: "npm run db:deploy" },
  { num: 6, id: "seed-passwords", category: "required", kind: "ops", label: "Seed solo primo env; password reali" },
  { num: 7, id: "nextauth", category: "required", kind: "ops", label: "NEXTAUTH_URL + NEXTAUTH_SECRET (≥32)" },
  { num: 8, id: "primary-host", category: "required", kind: "ops", label: "ONIZUKA_PRIMARY_HOST=onizuka.it" },
  { num: 9, id: "storage-s3", category: "required", kind: "ops", label: "Storage S3/R2 in produzione" },
  { num: 10, id: "cron-secret", category: "required", kind: "repo", label: "CRON_SECRET + cron Vercel (vercel.json)" },
  { num: 11, id: "dns", category: "required", kind: "ops", label: "DNS onizuka.it + www → Vercel + SSL" },
  { num: 12, id: "smoke-prod", category: "required", kind: "repo", label: "Smoke HTTP (npm run smoke:prod)" },
  { num: 13, id: "go-live-hub", category: "required", kind: "repo", label: "/admin/go-live — 0 obbligatori todo" },
  { num: 14, id: "admin-upload", category: "required", kind: "ops", label: "Login admin + upload; no seed deboli" },
  { num: 15, id: "smtp", category: "recommended", kind: "ops", label: "SMTP (digest, ticket, preventivi)" },
  { num: 16, id: "gha-cron", category: "recommended", kind: "repo", label: "GHA cron audit-sheet + dedupe", hint: ".github/workflows/README.md" },
  { num: 17, id: "upstash", category: "recommended", kind: "ops", label: "Upstash rate limit + bus notifiche" },
  { num: 18, id: "webhook-test", category: "recommended", kind: "ops", label: "Test webhook da /admin/webhooks" },
  { num: 19, id: "deploy-verify", category: "recommended", kind: "repo", label: "npm run deploy:verify" },
  { num: 20, id: "n8n", category: "optional", kind: "ops", label: "N8N_API_KEY" },
  { num: 21, id: "audit-sheet", category: "optional", kind: "ops", label: "Google Sheet audit (CSV/API)" },
  { num: 22, id: "meta-linkedin", category: "optional", kind: "ops", label: "Meta + LinkedIn publish nativo" },
  { num: 23, id: "openai", category: "optional", kind: "ops", label: "OPENAI + memoria RAG" },
  { num: 24, id: "gpu-dedupe", category: "optional", kind: "ops", label: "GPU dedupe training" },
  { num: 25, id: "k8s-worker", category: "optional", kind: "ops", label: "K8s automation worker" },
  { num: 26, id: "staging", category: "optional", kind: "ops", label: "Staging Vercel + DB" },
  { num: 27, id: "hostinger-marketing", category: "optional", kind: "ops", label: "Sito marketing Hostinger" },
  { num: 28, id: "drive-parent", category: "optional", kind: "ops", label: "Drive parent condivisa (Workspace)" },
  { num: 29, id: "partner-pdf", category: "optional", kind: "ops", label: "PDF contratti partner su Drive" },
  { num: 30, id: "integrations", category: "optional", kind: "ops", label: "Integrazioni da card go-live" },
];

/** Route pubbliche per smoke (PASSI-MANCANTI §4). */
export const PASSI_MANCANTI_SMOKE_ROUTES = [
  { path: "/api/health", name: "Health liveness" },
  { path: "/api/health/ready", name: "Health readiness" },
  { path: "/walkin", name: "Walk-in" },
  { path: "/status", name: "Status pubblico" },
  { path: "/login", name: "Login" },
  { path: "/robots.txt", name: "robots.txt" },
  { path: "/.well-known/security.txt", name: "security.txt" },
] as const;
