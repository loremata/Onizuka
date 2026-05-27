# Navigazione cliente univoca (360°)

## Punto canonico

Ogni riferimento a un’azienda in admin deve portare a:

**`/admin/clients/[id]`** — scheda 360° con timeline, health score, hub moduli.

## Componenti riusabili

| Componente | Path | Uso |
|------------|------|-----|
| `ClientLink` | `src/components/onizuka/client-link.tsx` | Nome cliente cliccabile |
| `LeadLink` | stesso file | Lead in pipeline |
| `EntityClientLabel` | stesso file | Cliente o lead in liste |
| `ClientContextBar` | `src/components/onizuka/client-context-bar.tsx` | Barra contesto su opp./preventivi |
| `ClientHubNav` | `src/components/onizuka/client-hub-nav.tsx` | Scorciatoie moduli filtrati |

## Filtri per `clientId`

| Modulo | URL |
|--------|-----|
| Opportunità | `/admin/crm/opportunities?clientId=` |
| Pipeline | `/admin/crm/pipeline?clientId=` |
| Flow | `/admin/flow?clientId=` |
| Memoria | `/admin/memory?clientId=` |
| Contenuti | `/admin/posts?clientId=` |
| Reach | `/admin/reach?clientId=` |
| Ticket | `/admin/client-portal/tickets?clientId=` |
| Finance | `/admin/finance?clientId=` |

## Identità fiscale univoca

- Una scheda `Client` per **P.IVA** o **codice fiscale** normalizzati (`src/lib/client-fiscal-identity.ts`).
- Creazione/aggiornamento anagrafica: `assertFiscalIdentityUnique` in `src/app/admin/clients/actions.ts`.
- Prospect da audit VAT: `findClientByFiscalIdentity` in `src/lib/prospect-vat-pipeline.ts`.
- Scheda 360°: pannelli `Client360CommercialPanels` + `loadClient360Profile` (servizi, proposte, cross-sell, Reach, finance, rinnovi, persone).

## Ricerca globale

- Bucket **Persone (CRM)** in `/admin/search?q=…` (`src/lib/global-search.ts`).

## Persona ↔ azienda

- Referente su scheda → sync → `/admin/crm/people`
- Da referenti: pulsante **Persona CRM** se collegamento esiste

## Convenzione

- **Non** usare `/admin/clients/[id]/edit` come destinazione principale nelle liste.
- **Edit** solo da azione esplicita «Modifica anagrafica».
