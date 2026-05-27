/**
 * Avvia Postgres locale: container con porta host corretta, altrimenti docker compose.
 */
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

function inspect(name, format) {
  return execSync(`docker inspect -f "${format}" ${name}`, {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

function containerRunning(name) {
  try {
    return inspect(name, "{{.State.Running}}") === "true";
  } catch {
    return false;
  }
}

function mappedHostPort(name) {
  try {
    const raw = execSync(`docker inspect ${name}`, {
      cwd: root,
      encoding: "utf8",
    });
    const binding = JSON.parse(raw)[0]?.NetworkSettings?.Ports?.["5432/tcp"];
    return binding?.[0]?.HostPort ?? null;
  } catch {
    return null;
  }
}

function expectedHostPort() {
  const url = process.env.DATABASE_URL;
  if (!url) return "5433";
  try {
    const { port } = new URL(url.replace(/^postgresql:/, "http:"));
    return port || "5433";
  } catch {
    return "5433";
  }
}

const hostPort = expectedHostPort();
/** Compose recente prima; legacy senza port mapping dopo */
const CANDIDATE_NAMES = ["onizuka-postgres-1", "onizuka-postgres"];

let started = false;
for (const name of CANDIDATE_NAMES) {
  if (!containerRunning(name)) continue;

  const mapped = mappedHostPort(name);
  if (mapped === hostPort) {
    console.log(`Postgres già in esecuzione (${name}, porta host ${hostPort}).`);
    started = true;
    break;
  }

  console.warn(
    `Container ${name} attivo ma porta host ${mapped ?? "assente"} ≠ ${hostPort}; uso docker compose.`
  );
}

if (!started) {
  try {
    run("docker compose up -d --remove-orphans");
    console.log(`Postgres avviato con docker compose (porta host ${hostPort}).`);
    started = true;
  } catch {
    throw new Error(
      "Impossibile avviare Postgres. Avvia Docker Desktop, poi: npm run db:up"
    );
  }
}
