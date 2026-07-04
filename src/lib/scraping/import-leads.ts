// Importa le aziende risolte come Lead in Onizuka, deduplicando contro il CRM
// esistente. Regole (volere: DB perfetto, mai due mail alla stessa azienda):
//  - SOLO aziende attive (cessate/liquidazione escluse a monte dal resolver).
//  - Dedup per P.IVA su Client E Lead esistenti (identità fiscale ufficiale).
//  - Dedup per telefono / dominio sito quando la P.IVA manca (solo-Google).
//  - In bulk NON si scatenano notifiche/automazioni (si eviterebbe uno spam).
import { prisma } from "@/lib/prisma";
import { normalizeFiscalIdentity } from "@/lib/fiscal-normalize";
import { findClientByFiscalIdentity } from "@/lib/client-fiscal-identity";
import { ensureClientForLead } from "@/lib/ensure-client-for-lead";
import type { ResolvedCompany, ProgressFn } from "./types";

export interface ImportResult {
  created: number;
  skippedExisting: number;
  skippedInvalid: number;
  excludedInactive: number;
}

// Verifica se un'azienda è già nel CRM (Client o Lead) per identità fiscale o contatto.
async function esisteGia(c: ResolvedCompany): Promise<boolean> {
  const { vatNumber } = normalizeFiscalIdentity({ vatNumber: c.partitaIva });

  if (vatNumber) {
    const client = await findClientByFiscalIdentity({ vatNumber });
    if (client) return true;
    const lead = await prisma.lead.findFirst({
      where: { vatNumber: { equals: vatNumber, mode: "insensitive" } },
      select: { id: true },
    });
    if (lead) return true;
    return false;
  }

  // Senza P.IVA (solo-Google): dedup per placeId, telefono o dominio sito.
  const ors: object[] = [];
  if (c.googlePlaceId) ors.push({ googlePlaceId: c.googlePlaceId });
  if (c.telefono) ors.push({ phone: { contains: c.telefono.replace(/\D/g, "").slice(-9) } });
  if (c.dominioSito) ors.push({ website: { contains: c.dominioSito, mode: "insensitive" } });
  if (ors.length === 0) return false;
  const lead = await prisma.lead.findFirst({ where: { OR: ors }, select: { id: true } });
  return Boolean(lead);
}

export async function importScrapedCompanies(
  params: { ownerUserId: string; comune: string; companies: ResolvedCompany[] },
  onProgress?: ProgressFn
): Promise<ImportResult> {
  const { ownerUserId, comune, companies } = params;
  const res: ImportResult = { created: 0, skippedExisting: 0, skippedInvalid: 0, excludedInactive: 0 };

  let i = 0;
  for (const c of companies) {
    i++;
    if (!c.attiva) { res.excludedInactive++; continue; }
    const nome = (c.nome || c.nomeVetrina).trim();
    if (!nome) { res.skippedInvalid++; continue; }

    try {
      if (await esisteGia(c)) { res.skippedExisting++; continue; }

      const { vatNumber } = normalizeFiscalIdentity({ vatNumber: c.partitaIva });
      const senzaPiva = !vatNumber;

      const lead = await prisma.lead.create({
        data: {
          title: nome,
          businessName: nome,
          vatNumber: vatNumber || null,
          phone: c.telefono || null,
          website: c.sitoWeb || null,
          city: c.citta || comune,
          googlePlaceId: c.googlePlaceId || null,
          source: senzaPiva ? `scraping-google:${comune}` : `scraping:${comune}`,
          status: "NEW",
          commercialProspectStage: "PROSPECT_ENTERED",
          ownerUserId,
          notes: [
            c.ateco ? `ATECO: ${c.ateco}` : "",
            c.dipendenti ? `Dipendenti: ${c.dipendenti}` : "",
            c.rating !== "" ? `Google: ${c.rating}★ (${c.nRecensioni} recensioni)` : "",
            senzaPiva ? "⚠️ Da Google, P.IVA da verificare." : "",
          ].filter(Boolean).join(" · ") || null,
        },
      });

      // Crea il Client satellite come nel flusso ufficiale (no automazioni in bulk).
      await ensureClientForLead(lead.id);
      res.created++;
    } catch {
      res.skippedInvalid++;
    }

    if (i % 20 === 0 || i === companies.length) {
      await onProgress?.({ phase: "import", current: i, total: companies.length, note: `${res.created} creati` });
    }
  }

  return res;
}
