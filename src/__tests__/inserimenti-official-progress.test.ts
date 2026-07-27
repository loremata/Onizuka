/**
 * Avanzamento gara: il confronto fra quello che ho registrato al banco e quello
 * che TIM riconosce deve avvenire sul PESO DI GARA, non sul numero di righe.
 *
 * Il bug che questi test bloccano: il file pesava a mano solo il Fisso, con una
 * costante locale. Sui Contenuti confrontava pezzi grezzi contro punti TIM, così
 * con 2 TIMVision L registrati (= 6 pezzi di gara) e 6 comunicati da TIM
 * stampava "TIM ne riconosce 4 in più: 4 vendite non registrate" e mandava a
 * registrare quattro vendite che non esistono.
 */

import { compareOfficialVsRegistered } from "@/lib/inserimenti/official-progress";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    incentiveOfficialProgress: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    storeSale: { groupBy: jest.fn(), count: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("@/lib/prisma");

type OfficialRow = { lineKey: string; qty: number };
type SaleGroup = { lineKey: string; subtype: string | null; count: number };

/** Prepara le risposte di Prisma: avanzamento TIM + vendite registrate. */
function arrange(official: OfficialRow[], sales: SaleGroup[]) {
  prisma.incentiveOfficialProgress.findFirst.mockResolvedValue({
    asOfDate: new Date("2026-07-25T00:00:00.000Z"),
  });
  prisma.incentiveOfficialProgress.findMany.mockResolvedValue(
    official.map((o) => ({ ...o, domiciledQty: null, breakdown: null, notes: null })),
  );
  prisma.storeSale.groupBy.mockImplementation(async (args: { by: string[] }) => {
    // prima query: raggruppata per pista E subtype (serve a pesare)
    if (args.by.includes("subtype")) {
      return sales.map((s) => ({ lineKey: s.lineKey, subtype: s.subtype, _count: { _all: s.count } }));
    }
    // seconda query: solo le domiciliate, per il dettaglio
    return [];
  });
}

const run = () =>
  compareOfficialVsRegistered({ ownerUserId: "u1", brand: "TIM", month: "2026-07" });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("compareOfficialVsRegistered — il confronto usa il peso di gara", () => {
  test("2 TIMVision L contro 6 comunicati da TIM: quadra, nessuna vendita fantasma", async () => {
    arrange(
      [{ lineKey: "CONTENUTI", qty: 6 }],
      [{ lineKey: "CONTENUTI", subtype: "TIMVISION_L", count: 2 }],
    );
    const cmp = await run();
    const riga = cmp.rows.find((r) => r.lineKey === "CONTENUTI")!;

    expect(riga.registered).toBe(2); // le righe messe a registro
    expect(riga.registeredWeighted).toBe(6); // il loro peso di gara
    expect(riga.delta).toBe(0);
    expect(riga.status).toBe("OK");
    expect(riga.hint).not.toMatch(/non registrat/i);
    expect(cmp.totalToRecord).toBe(0); // prima diceva 4
  });

  test("il Fisso continua a pesare le FWA ricaricabili 0,5", async () => {
    arrange(
      [{ lineKey: "ACCESSO_FISSO", qty: 6.5 }],
      [
        { lineKey: "ACCESSO_FISSO", subtype: "FWA_RIC", count: 3 },
        { lineKey: "ACCESSO_FISSO", subtype: null, count: 5 },
      ],
    );
    const cmp = await run();
    const riga = cmp.rows.find((r) => r.lineKey === "ACCESSO_FISSO")!;

    expect(riga.registered).toBe(8);
    expect(riga.registeredFwaRic).toBe(3);
    expect(riga.registeredWeighted).toBe(6.5); // 5 + 3×0,5
    expect(riga.delta).toBe(0);
    expect(riga.status).toBe("OK");
  });

  test("su una pista senza pesi pezzi e peso coincidono e il peso non si mostra", async () => {
    arrange([{ lineKey: "MNP", qty: 6 }], [{ lineKey: "MNP", subtype: null, count: 11 }]);
    const cmp = await run();
    const riga = cmp.rows.find((r) => r.lineKey === "MNP")!;

    expect(riga.registered).toBe(11);
    expect(riga.registeredWeighted).toBeNull(); // niente doppio numero identico
    expect(riga.delta).toBe(5);
    expect(riga.status).toBe("DA_INSEGUIRE");
    expect(cmp.totalToChase).toBe(5);
  });

  test("un vero buco di registrazione resta segnalato", async () => {
    // TIM riconosce 9 Contenuti, io ne ho registrati 2 da 3 = 6 di peso: ne manca 1 vero
    arrange(
      [{ lineKey: "CONTENUTI", qty: 9 }],
      [{ lineKey: "CONTENUTI", subtype: "TIMVISION_L", count: 2 }],
    );
    const cmp = await run();
    const riga = cmp.rows.find((r) => r.lineKey === "CONTENUTI")!;

    expect(riga.delta).toBe(-3);
    expect(riga.status).toBe("DA_REGISTRARE");
    expect(cmp.totalToRecord).toBe(3);
  });

  test("le piste a punteggio non si deducono dalle vendite", async () => {
    arrange([{ lineKey: "TOP_CLUB", qty: 77.5 }], []);
    const cmp = await run();
    const riga = cmp.rows.find((r) => r.lineKey === "TOP_CLUB")!;

    expect(riga.registered).toBeNull();
    expect(riga.registeredWeighted).toBeNull();
    expect(riga.status).toBe("SOLO_UFFICIALE");
  });
});
