# Onizuka — Stato prodotto e archivi

**Checklist deploy:** [PASSI-MANCANTI.md](../PASSI-MANCANTI.md) · **Spec:** [ONIZUKA_MASTER_SPEC.md](./ONIZUKA_MASTER_SPEC.md)

## Verdetto (maggio 2026)

| Ambito | Stato |
|--------|--------|
| MVP `ONIZUKA_MASTER_SPEC` | **100%** |
| Port StationHQ | **100%** |
| Batch F (client 360) + G (checklist/tooling) | **100%** |
| Produzione | **Solo ops** → PASSI-MANCANTI |

## Batch implementati (riferimento)

| Batch | Contenuto |
|-------|-----------|
| Port 1–8 | walk-in, regia, intelligence, CRM esteso |
| E | activity register, attivazioni servizio |
| F | onboarding, commitment, chat, AI runs, SLA opp., meeting cron |
| G | checklist unificata, smoke, go-live hub |

Migrazione batch F: `20260620400000_audit_gap_batch_f`.

## Moduli (sintesi audit)

Core, CRM, Flow, Calendar, Finance, Audit, Reach, Sales, Drive, Memory, Voice, Insights, portale cliente, Social Pro, automazioni — tutti con route admin/app documentate in [ONIZUKA-AUDIT-GAP.md](./ONIZUKA-AUDIT-GAP.md).

## Archivi esterni (non gap)

| Fonte | Conclusione |
|-------|-------------|
| `Desktop/StationHQ` | Parità **100%** — archiviabile dopo go-live |
| `Backup Cursor` | Solo indici IDE; nessun codice Onizuka |
| Prodotto `bd-ch` (Kelkoo) | **Fuori scope** |

Batch F ha coperto le voci “client 360” opzionali citate nei vecchi gap analysis (onboarding, commitment, meeting, SLA opportunità, chat, AI runs).

## Comandi deploy

```bash
npm run passi-mancanti:prod
DIRECT_URL=… npm run db:deploy
```
