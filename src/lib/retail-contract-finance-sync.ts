import type { ClientRetailContract } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Crea o aggiorna voce Finance MRR collegata a contratto retail ACTIVE. */
export async function syncFinanceEntryForRetailContract(contract: ClientRetailContract): Promise<string | null> {
  if (contract.status !== "ACTIVE") {
    if (contract.financeEntryId) {
      // Contratto non attivo: l'MRR smette di ricorrere e non deve più comparire nei rinnovi.
      await prisma.financeEntry.updateMany({
        where: { id: contract.financeEntryId },
        data: { recurringMonthly: false, renewalDate: null },
      });
    }
    return contract.financeEntryId;
  }

  const label = `MRR retail · ${contract.label}`;
  const amount = Number(contract.monthlyEur.toString());

  if (contract.financeEntryId) {
    await prisma.financeEntry.update({
      where: { id: contract.financeEntryId },
      data: {
        label,
        amountEur: amount,
        clientId: contract.clientId,
        type: "INCOME",
        recurringMonthly: true,
        renewalDate: contract.renewalDate,
        status: "EXPECTED",
      },
    });
    return contract.financeEntryId;
  }

  const created = await prisma.financeEntry.create({
    data: {
      ownerUserId: contract.ownerUserId,
      clientId: contract.clientId,
      label,
      type: "INCOME",
      amountEur: amount,
      recurringMonthly: true,
      renewalDate: contract.renewalDate,
      status: "EXPECTED",
    },
  });

  await prisma.clientRetailContract.update({
    where: { id: contract.id },
    data: { financeEntryId: created.id },
  });

  return created.id;
}
