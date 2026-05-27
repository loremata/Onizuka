import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** Account demo del seed con password predefinite (cambiare in produzione). */
export const SEED_DEFAULT_CREDENTIALS: { email: string; password: string }[] = [
  { email: "admin@agency.com", password: "admin123" },
  { email: "client@democlient.com", password: "client123" },
  { email: "other@otherco.com", password: "other123" },
];

/** Email che usano ancora la password del seed. */
export async function findAccountsWithDefaultSeedPasswords(): Promise<string[]> {
  const emails = SEED_DEFAULT_CREDENTIALS.map((a) => a.email);
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, passwordHash: true },
  });

  const weak: string[] = [];
  for (const user of users) {
    const spec = SEED_DEFAULT_CREDENTIALS.find((a) => a.email === user.email);
    if (!spec?.password || !user.passwordHash) continue;
    if (await compare(spec.password, user.passwordHash)) {
      weak.push(user.email);
    }
  }
  return weak;
}
