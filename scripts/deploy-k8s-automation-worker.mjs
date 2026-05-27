#!/usr/bin/env node
/**
 * Applica manifest worker automazioni e stampa comandi post-deploy.
 * Uso: node scripts/deploy-k8s-automation-worker.mjs [--dry-run]
 */
import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = path.join(__dirname, "..", "deploy", "k8s", "automation-worker.yaml");
const dryRun = process.argv.includes("--dry-run");

const yaml = readFileSync(manifest, "utf8");
if (dryRun) {
  console.log("--- dry-run manifest ---\n");
  console.log(yaml);
  process.exit(0);
}

const kubectl = spawnSync("kubectl", ["apply", "-f", manifest], { encoding: "utf8" });
console.log(kubectl.stdout || kubectl.stderr);
if (kubectl.status !== 0) {
  console.error("kubectl apply fallito. Verifica kubeconfig e namespace.");
  process.exit(kubectl.status ?? 1);
}

console.log(`
Post-deploy:
1. Aggiorna Secret onizuka-worker-secrets (cron_secret = CRON_SECRET produzione)
2. ConfigMap onizuka-worker-config app_url = NEXTAUTH_URL
3. kubectl rollout status deployment/onizuka-automation-worker
4. GET /api/health/automation-worker (da rete cluster o port-forward)
`);
