# ONIZUKA - Specifica Master

**Strategia e architettura:** [PUNTO-SITUA-DEFINITIVO.md](./PUNTO-SITUA-DEFINITIVO.md) · **Checklist Cursor:** [CURSOR-CHECKLIST-ONIZUKA.md](./CURSOR-CHECKLIST-ONIZUKA.md)

## Definizione

Onizuka e il **Business Operating System interno** di Lorenzo Matarazzo e futura Online Station — clone operativo di Lorenzo.

- **Non** e prodotto pubblico, SaaS o brand commerciale.
- **Online Station** e il contenitore aziendale/commerciale; i **brand verticali** comunicano al mercato.
- UI e documentazione funzionale usano solo **Onizuka** (mai StationHQ, SINFONIA, DRAKKAR, OPERA, SKALD, OUVERTURE, MAESTRO).

## Missione

Restituire tempo, aumentare controllo, moltiplicare produttivita, migliorare decisioni e accelerare la crescita economica degli asset.

## Priorita P0

- Rinominare progetto in Onizuka
- Eliminare riferimenti UI a StationHQ
- Struttura moduli unificata
- Database base
- CRM base
- Task system
- Command Center
- Memoria manuale
- Barra comando globale

## Moduli Onizuka

- Onizuka Core
- Onizuka Voice
- Onizuka Memory
- Onizuka CRM
- Onizuka Flow
- Onizuka Calendar
- Onizuka Finance
- Onizuka Audit
- Onizuka Reach
- Onizuka Sales
- Onizuka Drive
- Onizuka Client Portal
- Onizuka Insights

## Stack consigliato

- Next.js + TypeScript
- Tailwind CSS + shadcn/ui
- Prisma
- PostgreSQL in produzione
- SQLite solo prototipo locale
- Provider AI astratto
- Integrazioni: n8n, Google Calendar, Gmail, Drive, Telegram

## Prompt operativo per Cursor

```txt
Stiamo costruendo ONIZUKA, il sistema operativo intelligente personale, aziendale e commerciale di Lorenzo Matarazzo.

Regola fondamentale:
StationHQ non esiste piu come identita separata. Tutte le funzionalita precedentemente pensate per StationHQ confluiscono dentro Onizuka.

Primo obiettivo implementativo:
costruire MVP 1 con:
1. layout principale Onizuka
2. Command Center
3. CRM base
4. scheda cliente
5. task system
6. note/memoria manuale
7. barra comando globale
8. struttura modulare pronta per audit, outreach, finance, voice e client portal
```

## Regola di progettazione finale

Ogni nuova funzione deve rispondere almeno a una domanda:

1. Fa risparmiare tempo?
2. Aumenta controllo operativo?
3. Migliora una decisione?
4. Aiuta a vendere?
5. Riduce dispersione?
6. Protegge memoria e contesto?
7. Aumenta ricavi o marginalita?
8. Evita sovraccarico cognitivo operativo?
