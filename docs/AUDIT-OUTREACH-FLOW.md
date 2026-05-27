# Flusso post-audit e prima email outreach

_Analisi e miglioramenti implementati (maggio 2026)_

## Flusso attuale (dopo pipeline P.IVA o audit manuale)

```mermaid
flowchart TD
  A[Audit digitale COMPLETED] --> B[Bozza Reach PENDING_APPROVAL]
  A --> C[Preventivo DRAFT]
  A --> D[Sequenza J+0 J+3 J+7]
  A --> E[Task Flow: approva email domani]
  A --> F[Task Flow: verifica invio J+1]
  A --> G[Task Flow: follow-up commerciale J+5]
  A --> H[Lead follow-up 7d]
  B --> I[/admin/approvals Approva + Invia]
  I --> J[SMTP / Gmail API / mailto]
  C --> K[Invio preventivo email]
  K --> L[Reminder proposta non risposta J+5]
```

## Step automatici

| Step | Quando | Dove |
|------|--------|------|
| Audit + PDF Drive | Immediato | `digital-audit-run.ts` |
| Bozza 1ª email (template brand) | Immediato, `PENDING_APPROVAL` | `audit-outreach-draft.ts` |
| Sequenza follow-up email | Step 0 = bozza esistente; J+3, J+7 | `createAuditOutreachSequence` |
| Preventivo bozza | Se servizio consigliato | `draft-quote-from-audit.ts` |
| Approva email (task) | Giorno successivo | `audit-follow-up.ts` |
| Verifica invio 1ª email | +1 giorno lavorativo | **Nuovo** `audit-follow-up.ts` |
| Follow-up commerciale | +5 giorni lavorativi | `audit-follow-up.ts` |
| Lead follow-up | +7 giorni | `prospect-vat-pipeline.ts` |
| Proposta non risposta | +5 gg lavorativi dopo invio preventivo | `quote-no-response.ts` |

## Miglioramenti inseriti in questo ciclo

1. **Prima email** — oggetto/corpo da `BRAND_PROPOSAL_TEMPLATES` quando il brand consigliato ha template; altrimenti testo contestuale con punteggio audit.
2. **Lead collegato** — bozza Reach con `leadId` nella pipeline P.IVA.
3. **Verifica invio** — task Flow dedicato a J+1 per controllare che la prima mail sia partita.
4. **Approval Queue** — approvazione e invio senza uscire da `/admin/approvals`.

## Step consigliati (evoluzione)

| Priorità | Step | Note |
|----------|------|------|
| Alta | Auto-approvazione bozza solo per prospect interni `@onizuka.local` | Evitare in prod |
| Media | Allegare link report pubblico audit nell’email | `ensureDigitalAuditPublicReportToken` |
| Media | Task J+2 se bozza ancora `PENDING_APPROVAL` | Escalation |
| Media | Dopo invio 1ª email → aggiornare `commercialProspectStage` a `FIRST_CONTACT_SENT` | Nuovo enum stage |
| Bassa | WhatsApp snippet da `outreachCallScript` | Reach WhatsApp panel |

## Invio prima mail — checklist operatore

1. `/admin/approvals` → gruppo **Email commerciali** → **Approva** → **Invia via SMTP** o **Apri in email**.
2. Se mailto: dopo invio manuale → **Segna inviata** in Reach (tracking A/B).
3. Completare importi su **Preventivi** → inviare da scheda opportunità.
4. A J+3/J+7 la sequenza crea nuove bozze (cron sequenze / attivazione step).

## Variabili cron

| Env | Effetto |
|-----|---------|
| `QUOTE_NO_RESPONSE_CRON=0` | Disabilita reminder preventivo |
| `LEAD_FOLLOWUP_CRON=0` | Disabilita follow-up lead (incl. proposta non risposta su lead) |

Entrambi sono nel job `GET /api/cron/notifications`.
