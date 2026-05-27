/**
 * Allinea schema Prisma al DB locale e ripopola dati demo.
 * Usa dopo clone, reset volume Docker o errore "table Asset does not exist".
 */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

await import("./db-up.mjs");
run("node scripts/wait-postgres.mjs");
run("npx prisma migrate deploy");
run("npm run db:seed");
console.log("\n✓ Database sincronizzato (migrazioni + seed).");
