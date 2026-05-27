import { resolveAuditSheetCsvUrl } from "@/lib/audit-sheet-ingest";
import { isGoogleSheetsAuditApiConfigured } from "@/lib/google-sheets-audit";
import { isDedupeGpuWebhookEnabled } from "@/lib/dedupe-training-gpu";
import { isMetaNativePublishConfigured } from "@/lib/social-publish-meta";
import { isLinkedInNativePublishConfigured } from "@/lib/social-publish-linkedin";
import { isSupabaseCloudProvisionEnabled } from "@/lib/workspace-cloud-supabase";
import { isGoogleServiceAccountConfigured } from "@/lib/google-service-account";

export type OpsClosureItem = {
  id: string;
  label: string;
  status: "done" | "manual" | "optional";
  hint?: string;
  docPath?: string;
};

/** Checklist go-live implementabile in repo vs azione manuale una tantum. */
export function buildOpsClosureChecklist(): OpsClosureItem[] {
  const sheetCsv = Boolean(resolveAuditSheetCsvUrl());
  const sheetApi = isGoogleSheetsAuditApiConfigured();
  const sheetDone = sheetCsv || sheetApi;

  return [
    {
      id: "audit-sheet",
      label: "Google Sheet → coda audit",
      status: sheetDone ? "done" : "manual",
      hint: sheetDone
        ? sheetApi
          ? "Sheets API + service account"
          : "CSV export URL"
        : "GOOGLE_SHEET_AUDIT_* o service account",
    },
    {
      id: "dedupe-gpu-worker",
      label: "Worker GPU dedupe (script reference)",
      status: isDedupeGpuWebhookEnabled() ? "done" : "optional",
      hint: "scripts/dedupe-gpu-worker + DEDUPE_GPU_WEBHOOK_URL",
      docPath: "scripts/dedupe-gpu-worker/README.md",
    },
    {
      id: "k8s-automation",
      label: "Manifest K8s automation worker",
      status: "done",
      hint: "kubectl apply -f deploy/k8s/automation-worker.yaml",
      docPath: "deploy/k8s/automation-worker.yaml",
    },
    {
      id: "partner-legal",
      label: "Archivio contratti partner ERP",
      status: isGoogleServiceAccountConfigured() ? "optional" : "manual",
      hint: "URL Drive contratti in Impostazioni → Partner",
    },
    {
      id: "supabase-limit",
      label: "Limite progetti Supabase org",
      status: isSupabaseCloudProvisionEnabled() ? "done" : "optional",
      hint: "SUPABASE_MAX_ACTIVE_PROJECTS (default 10)",
    },
    {
      id: "meta-publish",
      label: "Publish nativo Meta (Facebook Page)",
      status: isMetaNativePublishConfigured() ? "done" : "optional",
      hint: "META_PAGE_ACCESS_TOKEN + META_PAGE_ID",
    },
    {
      id: "linkedin-publish",
      label: "Publish nativo LinkedIn",
      status: isLinkedInNativePublishConfigured() ? "done" : "optional",
      hint: "LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN",
    },
    {
      id: "unified-contacts",
      label: "Contatti unificati lead+clienti",
      status: "done",
      hint: "/admin/crm/contacts",
    },
    {
      id: "health-radar",
      label: "Client Health Radar",
      status: "done",
      hint: "/admin/crm/health-radar",
    },
    {
      id: "revenue-at-risk",
      label: "Revenue at risk (contratti retail)",
      status: "done",
      hint: "/admin/insights/revenue-at-risk",
    },
    {
      id: "lead-followup-cron",
      label: "Cron follow-up lead",
      status: "done",
      hint: "Incluso in /api/cron/notifications (LEAD_FOLLOWUP_CRON)",
    },
    {
      id: "quote-no-response-cron",
      label: "Cron proposta non risposta",
      status: "done",
      hint: "QUOTE_NO_RESPONSE_CRON in /api/cron/notifications",
    },
    {
      id: "person-entity-crm",
      label: "Entità Persona ↔ Azienda",
      status: "done",
      hint: "/admin/crm/people · backfill scripts/backfill-person-from-contacts.mjs",
    },
    {
      id: "opportunity-sla-cron",
      label: "Cron SLA opportunità",
      status: "done",
      hint: "OPPORTUNITY_SLA_CRON in notifications (=0 off)",
    },
    {
      id: "meeting-followthrough-cron",
      label: "Cron seguito meeting Flow",
      status: "done",
      hint: "Task [Meeting] · MEETING_FOLLOWTHROUGH_CRON",
    },
    {
      id: "onboarding-checklist",
      label: "Onboarding checklist cliente",
      status: "done",
      hint: "/admin/clients/[id]",
    },
    {
      id: "commitment-tracker",
      label: "Commitment tracker",
      status: "done",
      hint: "Pannello impegni su scheda cliente",
    },
    {
      id: "assistant-chat",
      label: "Chat assistente admin",
      status: "done",
      hint: "/admin/chat",
    },
    {
      id: "ai-runs",
      label: "Dashboard esecuzioni AI",
      status: "done",
      hint: "/admin/ai-runs",
    },
    {
      id: "opportunity-bottlenecks",
      label: "SLA opportunità (pagina)",
      status: "done",
      hint: "/admin/crm/opportunity-bottlenecks",
    },
    {
      id: "gha-cron-audit",
      label: "GHA cron audit-sheet-queue",
      status: "manual",
      hint: ".github/workflows/cron-audit-sheet-queue.yml + secrets",
    },
    {
      id: "gha-cron-dedupe",
      label: "GHA cron dedupe-training",
      status: "manual",
      hint: ".github/workflows/cron-dedupe-training.yml + secrets",
    },
    {
      id: "activity-register",
      label: "Registro attività",
      status: "done",
      hint: "/admin/activity",
    },
    {
      id: "service-activations",
      label: "Report attivazioni servizi",
      status: "done",
      hint: "/admin/reports/service-activations",
    },
    {
      id: "dns",
      label: "DNS dominio → Vercel",
      status: "manual",
      hint: "Hostinger / Vercel Domains",
    },
    {
      id: "k8s-apply",
      label: "Deploy worker su cluster cliente",
      status: "manual",
      hint: "node scripts/deploy-k8s-automation-worker.mjs",
    },
    {
      id: "gpu-run",
      label: "Avvio container worker GPU",
      status: "manual",
      hint: "docker run scripts/dedupe-gpu-worker",
    },
  ];
}
