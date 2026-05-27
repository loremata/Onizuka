/**
 * Termina processi in ascolto su 3000/3001 (evita più istanze Next che corrompono .next).
 */
import { execSync } from "child_process";

const ports = [3000, 3001];

if (process.platform === "win32") {
  for (const port of ports) {
    try {
      execSync(
        `powershell -NoProfile -Command "$p = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($id in $p) { if ($id -gt 0) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }"`,
        { stdio: "ignore" }
      );
    } catch {
      // nessun processo sulla porta
    }
  }
} else {
  for (const port of ports) {
    try {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: "ignore", shell: true });
    } catch {
      // ignore
    }
  }
}

console.log("Porte dev 3000/3001 liberate (se erano in uso).");
