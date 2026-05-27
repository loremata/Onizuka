/**
 * Pulisce cache di build prima di `next dev` per evitare errori tipo
 * "Cannot find module './1682.js'" dopo refresh o più istanze dev.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const dirs = [
  path.join(root, ".next"),
  path.join(root, "node_modules", ".cache"),
];

for (const dir of dirs) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Rimosso: ${path.relative(root, dir)}`);
  }
}
