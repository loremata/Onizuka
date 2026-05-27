import type { FinanceEntry } from "@prisma/client";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type FatturaPaInput = {
  entry: Pick<
    FinanceEntry,
    "id" | "label" | "invoiceNumber" | "amountEur" | "dueDate" | "paidAt" | "type"
  >;
  clientName: string | null;
  clientVat: string | null;
  issuerName: string;
  issuerVat: string;
};

/** XML semplificato FatturaPA (bozza export — validazione SDI in roadmap). */
export function buildFatturaPaXml(input: FatturaPaInput): string {
  const amount = Number(input.entry.amountEur.toString()).toFixed(2);
  const number = input.entry.invoiceNumber ?? `ONZ-${input.entry.id.slice(0, 8)}`;
  const date = (input.entry.paidAt ?? input.entry.dueDate ?? new Date()).toISOString().slice(0, 10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${esc(input.issuerVat.replace(/\D/g, "").slice(0, 11) || "00000000000")}</IdCodice></IdTrasmittente>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici><Anagrafica><Denominazione>${esc(input.issuerName)}</Denominazione></Anagrafica></DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici><Anagrafica><Denominazione>${esc(input.clientName ?? "Cliente")}</Denominazione></Anagrafica></DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Numero>${esc(number)}</Numero>
        <Data>${date}</Data>
        <ImportoTotaleDocumento>${amount}</ImportoTotaleDocumento>
        <Causale>${esc(input.entry.label)}</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
}

export function fatturaPaFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `fattura-${safe || "bozza"}.xml`;
}
