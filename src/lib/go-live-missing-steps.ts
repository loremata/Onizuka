import type { ReadinessItem } from "@/lib/production-readiness";
import type { OpsClosureItem } from "@/lib/ops-readiness";

export type MissingStepCategory = "required" | "recommended" | "optional";

export type MissingStep = {
  id: string;
  category: MissingStepCategory;
  label: string;
  status: "done" | "todo" | "manual";
  hint?: string;
};

export type GoLiveMissingStepsReport = {
  steps: MissingStep[];
  requiredOpen: number;
  recommendedOpen: number;
  optionalOpen: number;
  productCodeComplete: boolean;
};

const MANUAL_REQUIRED: Omit<MissingStep, "status">[] = [
  {
    id: "dns",
    category: "required",
    label: "DNS onizuka.it (+ www) → Vercel + SSL",
    hint: "Hostinger A/CNAME · Vercel Domains",
  },
  {
    id: "smoke-prod",
    category: "required",
    label: "Smoke test post-deploy",
    hint: "BASE_URL=https://onizuka.it npm run smoke:prod · pannello /admin/go-live",
  },
];

const MANUAL_RECOMMENDED: Omit<MissingStep, "status">[] = [
  {
    id: "gha-cron",
    category: "recommended",
    label: "GitHub Actions cron (audit-sheet, dedupe)",
    hint: "Secrets ONIZUKA_CRON_*_URL + CRON_SECRET nei workflow .github/workflows",
  },
  {
    id: "smtp",
    category: "recommended",
    label: "SMTP (digest, ticket, preventivi)",
    hint: "SMTP_HOST, SMTP_USER, SMTP_PASS",
  },
  {
    id: "upstash",
    category: "recommended",
    label: "Upstash (rate limit login + bus notifiche)",
    hint: "UPSTASH_REDIS_REST_URL + TOKEN",
  },
];

const MANUAL_OPTIONAL: Omit<MissingStep, "status">[] = [
  {
    id: "n8n",
    category: "optional",
    label: "N8N_API_KEY (automazioni esterne)",
  },
  {
    id: "staging",
    category: "optional",
    label: "Ambiente staging Vercel + DB",
    hint: "docs/STAGING.md · vercel-env.staging.template",
  },
  {
    id: "hostinger-marketing",
    category: "optional",
    label: "Sito marketing Hostinger",
    hint: "docs/HOSTINGER-MARKETING.md",
  },
  {
    id: "k8s-worker",
    category: "optional",
    label: "Deploy worker K8s automazioni",
    hint: "node scripts/deploy-k8s-automation-worker.mjs",
  },
  {
    id: "gpu-dedupe",
    category: "optional",
    label: "Worker GPU dedupe ML",
    hint: "scripts/dedupe-gpu-worker",
  },
  {
    id: "drive-parent",
    category: "optional",
    label: "Condivisione cartella Drive parent (Workspace)",
    hint: "Google Workspace admin",
  },
];

function fromReadiness(r: ReadinessItem): MissingStep {
  const category: MissingStepCategory =
    r.id === "dns" ? "required" : r.status === "todo" ? "required" : "optional";
  return {
    id: `env-${r.id}`,
    category: r.status === "todo" ? "required" : "optional",
    label: r.label,
    status: r.status === "done" ? "done" : r.status === "todo" ? "todo" : "manual",
    hint: r.hint,
  };
}

function fromOps(o: OpsClosureItem): MissingStep | null {
  if (o.status === "done") return null;
  const category: MissingStepCategory =
    o.status === "manual" ? (o.id === "dns" ? "required" : "optional") : "optional";
  return {
    id: `ops-${o.id}`,
    category,
    label: o.label,
    status: o.status === "manual" ? "manual" : "todo",
    hint: o.hint,
  };
}

export function buildGoLiveMissingSteps(input: {
  readiness: ReadinessItem[];
  opsClosure: OpsClosureItem[];
  databaseOk: boolean;
  batchFMigrated: boolean;
  weakSeedEmails: string[];
  mustChangePasswordCount: number;
}): GoLiveMissingStepsReport {
  const steps: MissingStep[] = [];
  const seen = new Set<string>();

  const push = (s: MissingStep) => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    steps.push(s);
  };

  if (!input.databaseOk) {
    push({
      id: "db-connect",
      category: "required",
      label: "Connessione database",
      status: "todo",
      hint: "Verifica DATABASE_URL e che Supabase sia raggiungibile",
    });
  }

  if (!input.batchFMigrated) {
    push({
      id: "migrate-batch-f",
      category: "required",
      label: "Migrazione DB batch F (onboarding, chat, AI runs)",
      status: "todo",
      hint: "npx prisma migrate deploy",
    });
  }

  const directUrl = Boolean(process.env.DIRECT_URL?.trim());
  if (!directUrl) {
    push({
      id: "direct-url",
      category: "required",
      label: "DIRECT_URL (migrate deploy)",
      status: "todo",
      hint: "Porta 5432 Supabase per prisma migrate deploy",
    });
  }

  for (const r of input.readiness) {
    if (r.status === "todo") push(fromReadiness(r));
  }

  if (input.weakSeedEmails.length > 0) {
    push({
      id: "seed-passwords",
      category: "required",
      label: "Password utenti demo ancora deboli",
      status: "todo",
      hint: `${input.weakSeedEmails.length} account · cambia da /admin/go-live`,
    });
  }

  if (input.mustChangePasswordCount > 0) {
    push({
      id: "must-change-password",
      category: "required",
      label: "Utenti con cambio password obbligatorio",
      status: "todo",
      hint: `${input.mustChangePasswordCount} utenti devono aggiornare la password al login`,
    });
  }

  for (const m of MANUAL_REQUIRED) {
    push({ ...m, status: m.id === "dns" ? "manual" : "manual" });
  }

  const smtpItem = input.readiness.find((x) => x.id === "smtp");
  if (smtpItem && smtpItem.status !== "done") {
    push({
      id: "env-smtp",
      category: "recommended",
      label: smtpItem.label,
      status: "todo",
      hint: smtpItem.hint,
    });
  }
  const upstashItem = input.readiness.find((x) => x.id === "upstash");
  if (upstashItem && upstashItem.status !== "done") {
    push({
      id: "env-upstash",
      category: "recommended",
      label: upstashItem.label,
      status: "todo",
      hint: upstashItem.hint,
    });
  }

  push({
    ...MANUAL_RECOMMENDED[0]!,
    status: "manual",
  });

  for (const o of input.opsClosure) {
    const step = fromOps(o);
    if (step) push(step);
  }

  for (const m of MANUAL_OPTIONAL) {
    push({ ...m, status: "manual" });
  }

  const requiredOpen = steps.filter((s) => s.category === "required" && s.status === "todo").length;
  const recommendedOpen = steps.filter(
    (s) => s.category === "recommended" && s.status === "todo"
  ).length;
  const optionalOpen = steps.filter((s) => s.category === "optional" && s.status === "todo").length;

  return {
    steps: steps.sort((a, b) => {
      const cat = { required: 0, recommended: 1, optional: 2 };
      const d = cat[a.category] - cat[b.category];
      if (d !== 0) return d;
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return a.label.localeCompare(b.label, "it");
    }),
    requiredOpen,
    recommendedOpen,
    optionalOpen,
    productCodeComplete: true,
  };
}

export { PASSI_MANCANTI_SMOKE_ROUTES as PRODUCT_SMOKE_ROUTES } from "@/lib/passi-mancanti-catalog";
