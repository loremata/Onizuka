import { prisma } from "@/lib/prisma";

/**
 * TETTO GIORNALIERO AGLI INVII AUTOMATICI, E QUANDO ALZARLO.
 *
 * Il tetto vale solo per i follow-up che partono da soli. Gli invii manuali
 * non sono limitati: quelli sono una decisione presa una per una, e limitarli
 * significherebbe impedire a Lorenzo di fare il suo lavoro.
 *
 * Perché si parte bassi: un dominio che non ha mai mandato posta e comincia
 * con cento messaggi al giorno viene classificato come spam prima ancora di
 * essere letto. La reputazione si costruisce con volumi crescenti e nessun
 * reclamo — non si recupera con una richiesta.
 *
 * Il consigliere non è un timer: guarda i segnali veri e può anche dire
 * "non alzare" o "abbassa".
 */

/** Scaletta prudente. Ogni gradino circa raddoppia: salti più larghi bruciano. */
export const CAP_TIERS = [10, 25, 50, 100, 200] as const;
export const DEFAULT_CAP = CAP_TIERS[0];

/** Giorni che una soglia nuova deve reggere prima di poterne proporre un'altra. */
const SETTLE_DAYS = 7;
/** Oltre questa quota di disiscrizioni il problema non è il volume: è il messaggio. */
const OPT_OUT_ALARM = 0.02;
/** Sotto questo uso del tetto, alzarlo non serve a niente. */
const MIN_USAGE = 0.6;

export type CapAdvice = {
  currentCap: number;
  sentToday: number;
  /** Media giornaliera degli ultimi 7 giorni. */
  avgDaily: number;
  sentLast7: number;
  optOutsLast7: number;
  optOutRate: number;
  daysSinceRaise: number | null;
  action: "raise" | "hold" | "lower" | "unused";
  suggestedCap: number | null;
  /** Frase pronta per l'interfaccia: dice cosa fare e perché. */
  message: string;
};

export async function currentDailyCap(ownerUserId: string): Promise<number> {
  const u = await prisma.user
    .findUnique({ where: { id: ownerUserId }, select: { reachDailySendCap: true } })
    .catch(() => null);
  return u?.reachDailySendCap ?? DEFAULT_CAP;
}

function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Quante mail sono già partite oggi (manuali incluse: contano per la reputazione). */
export async function sentToday(ownerUserId: string, now = new Date()): Promise<number> {
  return prisma.outreachDraft.count({
    where: { ownerUserId, status: "SENT", sentAt: { gte: startOfToday(now) } },
  });
}

/**
 * Il cancello usato prima di un invio AUTOMATICO. Gli invii manuali passano
 * sempre: il tetto protegge il dominio dalla macchina, non da Lorenzo.
 */
export async function isAutoSendAllowed(
  ownerUserId: string,
  now = new Date()
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const [cap, today] = await Promise.all([currentDailyCap(ownerUserId), sentToday(ownerUserId, now)]);
  if (today < cap) return { allowed: true };
  return {
    allowed: false,
    reason: `Tetto giornaliero raggiunto (${today}/${cap}): il follow-up riparte domani.`,
  };
}

/**
 * Il consigliere. Si basa su tre cose vere e misurabili: quanto stai usando il
 * tetto, quante disiscrizioni stai raccogliendo, da quanto regge la soglia
 * attuale. Non sui giorni passati e basta.
 */
export async function adviseDailyCap(ownerUserId: string, now = new Date()): Promise<CapAdvice> {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [user, today, last7, optOuts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { reachDailySendCap: true, reachCapRaisedAt: true },
    }),
    sentToday(ownerUserId, now),
    prisma.outreachDraft.count({
      where: { ownerUserId, status: "SENT", sentAt: { gte: weekAgo } },
    }),
    // Disiscrizioni nella stessa finestra: è IL segnale che conta.
    prisma.client.count({ where: { marketingOptOutAt: { gte: weekAgo } } }),
  ]);

  const cap = user?.reachDailySendCap ?? DEFAULT_CAP;
  const avgDaily = Math.round((last7 / 7) * 10) / 10;
  const optOutRate = last7 > 0 ? optOuts / last7 : 0;
  const daysSinceRaise = user?.reachCapRaisedAt
    ? Math.floor((now.getTime() - user.reachCapRaisedAt.getTime()) / 86_400_000)
    : null;
  const nextTier = CAP_TIERS.find((t) => t > cap) ?? null;

  const base = {
    currentCap: cap,
    sentToday: today,
    avgDaily,
    sentLast7: last7,
    optOutsLast7: optOuts,
    optOutRate: Math.round(optOutRate * 1000) / 10,
    daysSinceRaise,
  };

  // 1) Le disiscrizioni vengono prima di tutto: se la gente si toglie, il
  //    problema non è quante ne mandi.
  if (last7 >= 20 && optOutRate >= OPT_OUT_ALARM) {
    return {
      ...base,
      action: "lower",
      suggestedCap: Math.max(CAP_TIERS[0], Math.floor(cap / 2)),
      message: `${optOuts} disiscrizioni su ${last7} invii (${base.optOutRate}%): non è un problema di volume, è il messaggio. Abbassa e rivedi i testi prima di spingere.`,
    };
  }

  // 2) Niente da misurare.
  if (last7 === 0) {
    return {
      ...base,
      action: "hold",
      suggestedCap: null,
      message: `Nessun invio negli ultimi 7 giorni. Il tetto è ${cap}/giorno: si alza quando c'è qualcosa da misurare.`,
    };
  }

  // 3) Tetto non sfruttato: alzarlo non cambierebbe nulla.
  if (avgDaily < cap * MIN_USAGE) {
    return {
      ...base,
      action: "unused",
      suggestedCap: null,
      message: `Stai usando ${avgDaily} invii al giorno su ${cap} disponibili: alzare il tetto non servirebbe. Il collo di bottiglia sono le prime mail da approvare, non il limite.`,
    };
  }

  // 4) La soglia attuale deve aver retto qualche giorno.
  if (daysSinceRaise != null && daysSinceRaise < SETTLE_DAYS) {
    return {
      ...base,
      action: "hold",
      suggestedCap: null,
      message: `Tetto alzato ${daysSinceRaise} giorni fa. Aspetta di arrivare a ${SETTLE_DAYS} prima di alzarlo ancora: serve a vedere se la consegna regge.`,
    };
  }

  if (!nextTier) {
    return {
      ...base,
      action: "hold",
      suggestedCap: null,
      message: `Sei al massimo previsto (${cap}/giorno) e senza segnali negativi. Oltre questo volume conviene ragionare sul dominio di invio, non sul tetto.`,
    };
  }

  // 5) Via libera.
  return {
    ...base,
    action: "raise",
    suggestedCap: nextTier,
    message: `${last7} invii in 7 giorni, ${optOuts} disiscrizioni (${base.optOutRate}%), tetto sfruttato: puoi passare da ${cap} a ${nextTier} al giorno.`,
  };
}

/** Applica il nuovo tetto e registra la data: serve al consigliere. */
export async function setDailyCap(ownerUserId: string, cap: number): Promise<void> {
  const clamped = Math.max(1, Math.min(500, Math.round(cap)));
  const current = await currentDailyCap(ownerUserId);
  await prisma.user.update({
    where: { id: ownerUserId },
    data: {
      reachDailySendCap: clamped,
      // La data si aggiorna solo quando si ALZA: abbassare è una correzione,
      // non un esperimento da far decantare.
      ...(clamped > current ? { reachCapRaisedAt: new Date() } : {}),
    },
  });
}
