# Gap vs punto della situa definitivo

_Mappatura onesta codice attuale → target [PUNTO-SITUA-DEFINITIVO.md](./PUNTO-SITUA-DEFINITIVO.md)_

_Aggiornato: implementazione gap prioritari (maggio 2026)._

## Già allineato

| Target | Implementazione |
|--------|-----------------|
| Onizuka unico, no StationHQ in UI | `src/` pulito; layout «Onizuka» |
| 8 brand ecosistema + template proposta email | `commercial-catalog-seed.ts` |
| Moduli core (CRM, flow, memory, finance, audit, reach, portal, …) | ~96+ route admin |
| **Cliente 360° univoco** | `/admin/clients/[id]` + `ClientLink` / `ClientHubNav` — vedi [CLIENT-360-NAV.md](./CLIENT-360-NAV.md) |
| **Cliente Privato / Azienda** | `Client.kind`, `fiscalCode`, filtri CRM |
| **Macro Negozio / Digitale-AI** | `ClientMacroCategory`, catalogo esteso (SIM, FWA, gas, TIM Vision, …) |
| **Approval Queue** | `/admin/approvals` (reach + quote + post; Approva/Invia email in pagina) |
| **Workflow P.IVA** | `prospect-vat-pipeline.ts`, API `/api/admin/prospect-from-vat`, barra comando |
| **Cross-sell 10 pattern** | `/admin/crm/cross-sell` + `cross-sell-queries.ts` |
| **Documenti hub** | `/admin/documents` |
| **Economics per brand** | `/admin/economics` |
| Audit digitale + PDF + P.IVA | `DigitalAudit`, auto-create cliente da P.IVA |
| Stati prospect su lead | `CommercialProspectStage` su `Lead` |
| Google Sheet staging | `AuditSheetQueueItem` |
| Segnalatori / partner | `Referrer`, portale `/refer` |
| Comandi Ask minimi | `ask-onizuka.ts` esteso |

## Gap residui (evoluzione, non bloccanti MVP)

| Target | Gap | Priorità |
|--------|-----|----------|
| ~~Generazione preventivo automatica post-audit~~ | `draft-quote-from-audit.ts` + pipeline P.IVA | — |
| ~~Invio email post-approvazione one-click da Approval Queue~~ | Approva + Invia SMTP/mailto in `/admin/approvals` | — |
| ~~Reminder «proposta non risposta» dedicato~~ | `quote-no-response.ts` + cron + Action Inbox | — |
| ~~Relazione persona ↔ azienda~~ | `Person` + `PersonClientRole` · `/admin/crm/people` | — |
| Flusso post-audit (analisi + step) | [AUDIT-OUTREACH-FLOW.md](./AUDIT-OUTREACH-FLOW.md) | — |
| Funnel per brand (config UI) | Solo template email in seed | Bassa |
| Go-live produzione | Solo ops → PASSI-MANCANTI + playbook | Ops |

## Legacy → modulo Onizuka

| Legacy | Oggi in codice |
|--------|----------------|
| DRAKKAR | Lead, walk-in, dedupe, CRM, prospect P.IVA |
| OPERA | `/admin/audit/digital` |
| SKALD | `/admin/reach`, sequenze, Approval Queue |
| OUVERTURE | `/admin/posts`, `/admin/social` |
| MAESTRO | automazioni, Action Inbox, Ask, pipeline P.IVA |

## Migrazione DB

```bash
npm run db:deploy
# oppure: npx prisma migrate deploy
# migrazione: 20260620500000_punto_situa_definitivo
```
