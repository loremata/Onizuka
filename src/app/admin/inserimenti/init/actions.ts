"use server";

import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { MIGRATION_STATEMENTS, DATA_STATEMENTS } from "./statements";

/**
 * Go-live del modulo Inserimenti eseguito DALL'APP in produzione, a blocchi.
 *
 * Perché così: la password del DB di produzione non è leggibile da nessuna
 * postazione (Vercel la marca Sensitive), quindi migration e dati non possono
 * partire da un terminale. L'app invece la connessione ce l'ha già: questo
 * action applica gli statement (tutti additivi, zero DROP) con la connessione
 * runtime, e assegna i dati all'admin che preme il pulsante.
 *
 * Idempotente per costruzione: DDL con errori "already exists" ignorati,
 * INSERT con ON CONFLICT DO NOTHING. Ripremerlo non duplica niente — è anche
 * la strategia contro i timeout serverless: il client richiama a blocchi.
 */

const CHUNK = 50;

export interface InitStepResult {
  done: boolean;
  next: number;
  total: number;
  applied: number;
  skipped: number;
  error?: string;
}

/** Vero se l'errore è un "esiste già" (DDL riapplicata) e va ignorato. */
function isAlreadyExists(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /already exists|duplicate key|esiste già/i.test(msg);
}

export async function initInserimentiStep(offset: number): Promise<InitStepResult> {
  const session = await requireFullAdmin();
  const ownerId = session.user.id.replace(/'/g, "''");

  const all = [
    ...MIGRATION_STATEMENTS,
    ...DATA_STATEMENTS.map((s) => s.replace(/__OWNER__/g, `'${ownerId}'`)),
  ];
  const total = all.length;
  const start = Math.max(0, Math.floor(offset));

  let applied = 0;
  let skipped = 0;
  for (let i = start; i < Math.min(start + CHUNK, total); i++) {
    try {
      await prisma.$executeRawUnsafe(all[i]);
      applied++;
    } catch (e) {
      if (isAlreadyExists(e)) {
        skipped++;
        continue;
      }
      const msg = e instanceof Error ? e.message.split("\n").slice(-3).join(" ").slice(0, 400) : String(e);
      return { done: false, next: i, total, applied, skipped, error: `Statement ${i + 1}/${total}: ${msg}` };
    }
  }

  const next = Math.min(start + CHUNK, total);
  const done = next >= total;
  if (done) {
    revalidatePath("/admin/inserimenti");
    revalidatePath("/admin/inserimenti/gara-tim");
  }
  return { done, next, total, applied, skipped };
}

/** Stato del modulo in produzione: tabelle presenti? quanti dati? */
export async function initInserimentiStatus(): Promise<{
  tablesReady: boolean;
  plans: number;
  offers: number;
  sales: number;
}> {
  await requireFullAdmin();
  try {
    const [plans, offers, sales] = await Promise.all([
      prisma.incentivePlan.count(),
      prisma.storeOffer.count(),
      prisma.storeSale.count(),
    ]);
    return { tablesReady: true, plans, offers, sales };
  } catch {
    return { tablesReady: false, plans: 0, offers: 0, sales: 0 };
  }
}
