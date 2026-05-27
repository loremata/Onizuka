import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src", "app", "admin");
const restricted = ["finance", "users", "go-live", "webhooks"];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(tsx?)$/.test(ent.name)) files.push(p);
  }
  return files;
}

function isRestricted(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  return restricted.some((m) => rel.startsWith(`${m}/`) || rel === `${m}.tsx` || rel.startsWith(`${m}.`));
}

for (const file of walk(root)) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes('session.user.role !== "ADMIN"')) continue;

  const fullAdmin = isRestricted(file);
  const helper = fullAdmin ? "requireFullAdmin" : "requireAdminArea";

  if (!src.includes(`@/lib/admin-session`)) {
    src = src.replace(
      /import \{ authOptions \} from "@\/lib\/auth";/,
      `import { authOptions } from "@/lib/auth";\nimport { ${helper} } from "@/lib/admin-session";`
    );
    if (!src.includes(`@/lib/admin-session`)) {
      src = `import { ${helper} } from "@/lib/admin-session";\n` + src;
    }
  } else if (!src.includes(helper)) {
    src = src.replace(
      /import \{([^}]+)\} from "@\/lib\/admin-session";/,
      (m, names) => {
        const list = names.split(",").map((s) => s.trim()).filter(Boolean);
        if (!list.includes(helper)) list.push(helper);
        return `import { ${list.join(", ")} } from "@/lib/admin-session";`;
      }
    );
  }

  src = src.replace(
    /const session = await getServerSession\(authOptions\);\s*\n\s*if \(!session \|\| session\.user\.role !== "ADMIN"\) redirect\("\/login"\);/g,
    `const session = await ${helper}();`
  );

  src = src.replace(
    /async function ensureAdmin\(\) \{\s*const session = await getServerSession\(authOptions\);\s*if \(!session \|\| session\.user\.role !== "ADMIN"\) redirect\("\/login"\);\s*return session;\s*\}/g,
    `const ensureAdmin = ${helper};`
  );

  fs.writeFileSync(file, src);
  console.log("patched", path.relative(process.cwd(), file), fullAdmin ? "(full)" : "");
}
