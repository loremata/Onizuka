/**
 * Avvio dev affidabile: chiude porte, pulisce cache, un solo `next dev` su :3000.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { loadDotEnvFiles } = await import("./load-dotenv.mjs");
loadDotEnvFiles(root);

await import("./kill-dev-ports.mjs");
await import("./dev-prepare.mjs");

try {
  await import("./db-up.mjs");
  const { execSync } = await import("child_process");
  execSync("node scripts/wait-postgres.mjs", { cwd: root, stdio: "inherit" });
  try {
    execSync("npx prisma migrate deploy", { cwd: root, stdio: "pipe" });
  } catch {
    console.warn("⚠ Migrazioni non applicate. Esegui: npm run db:sync");
  }
} catch {
  console.warn("⚠ Postgres non disponibile: /login ok, /admin richiede il DB.");
}

const port = process.env.PORT || "3000";

console.log("");
console.log(`▶ Onizuka → http://localhost:${port}`);
console.log("  (Ctrl+C per fermare; non avviare un secondo npm run dev)");
console.log("");

const isWin = process.platform === "win32";
const cmd = isWin ? "npx.cmd" : "npx";
const child = spawn(cmd, ["next", "dev", "-p", port], {
  cwd: root,
  stdio: "inherit",
  shell: isWin,
  env: {
    ...process.env,
    PORT: port,
  },
});

const shutdown = () => {
  child.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

child.on("exit", (code) => process.exit(code ?? 0));
