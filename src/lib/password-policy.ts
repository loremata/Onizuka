import { SEED_DEFAULT_CREDENTIALS } from "@/lib/seed-password-check";

const EXTRA_WEAK = [
  "password",
  "password123",
  "12345678",
  "changeme",
  "admin",
  "qwerty123",
];

/** Password demo o troppo comuni — bloccate in produzione. */
export function isWeakPassword(password: string): boolean {
  const p = password.trim().toLowerCase();
  if (p.length < 8) return true;
  const seedPasswords = SEED_DEFAULT_CREDENTIALS.map((c) => c.password.toLowerCase());
  return seedPasswords.includes(p) || EXTRA_WEAK.includes(p);
}

export function weakPasswordMessage(): string {
  return "Scegli una password più forte: non usare password demo o comuni.";
}
