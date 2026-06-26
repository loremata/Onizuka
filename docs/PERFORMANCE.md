# Standard performance Onizuka

Regole per tenere veloci tutte le pagine. Valgono per ogni nuova pagina/loader.
Nascono dall'intervento del 2026-06-26 che ha portato la scheda cliente da ~4-6 s a <1 s.

## Le 3 regole

### 1. Mai seed / scritture di setup nel path di rendering
Le funzioni che popolano dati di setup (cataloghi, seed, default) **non** devono girare
a ogni render: fanno decine di scritture inutili a ogni apertura di pagina.

- ❌ `await seedCommercialCatalog()` dentro `page.tsx` o dentro un loader chiamato dal render.
- ✅ `await ensureCommercialCatalogSeeded()` — fa un solo `count` e semina solo se manca.
- Il seed "pieno" va eseguito una tantum (script/setup/azione), non sul render.

Pattern guardato di riferimento (`src/lib/commercial-catalog-seed.ts`):
```ts
export async function ensureCommercialCatalogSeeded() {
  const count = await prisma.commercialService.count();
  if (count >= COMMERCIAL_SERVICES.length) return { seeded: false };
  await seedCommercialCatalog();
  return { seeded: true };
}
```

### 2. Query indipendenti → sempre in parallelo (`Promise.all`)
Più `await prisma.*` in fila che **non dipendono** l'uno dal risultato dell'altro
vanno raggruppati in un solo `Promise.all`. Una cascata di N query costa N round-trip;
in parallelo costa 1.

- ✅ Raggruppa solo await **provatamente indipendenti**.
- ⚠️ Se una query usa il risultato di una precedente, lascia l'ordine (oppure usa
  `.then()` per agganciarla e metterla comunque nel batch — vedi `onboardingPromise`
  in `src/app/admin/clients/[id]/page.tsx`).

```ts
const [a, b, c] = await Promise.all([
  prisma.x.findMany(...),
  prisma.y.count(...),
  loadZ(id),
]);
```

### 3. Niente N+1: un `await` dentro un loop sul render è vietato
Un `await prisma.*` dentro `for`/`map` che cicla su clienti/righe = N round-trip.
Sostituisci con UNA query batch (`where: { id: { in: ids } }`, `groupBy`, join) e
ricomponi in memoria con una `Map`.

- ❌ `for (const c of clients) { const n = await prisma.x.count({ where: { clientId: c.id }}) }`
- ✅
```ts
const grouped = await prisma.x.groupBy({
  by: ["clientId"],
  where: { clientId: { in: clients.map(c => c.id) }, active: true },
  _count: { _all: true },
});
const byClient = new Map(grouped.map(g => [g.clientId, g._count._all]));
```

Esempi reali sistemati: `client-commercial-gaps.ts`, `insights-service-graph.ts`,
`cross-sell-queries.ts`.

> **Eccezione**: i job di **background/cron/sync/import** (queue processor, OAuth,
> dedupe, import CSV, sync social) possono restare sequenziali — spesso lo sono di
> proposito (ordine, idempotenza, rate-limit API esterne). La regola N+1 vale per il
> path di **rendering** (ciò che l'utente aspetta).

## Regola infrastrutturale (già applicata, globale)

Le funzioni serverless devono stare nella **stessa region del database**.
DB Supabase = AWS `eu-west-1` (Irlanda) → funzioni Vercel su `dub1` (Dublino).
Configurato in `vercel.json`:
```json
{ "regions": ["dub1"], "crons": [ ... ] }
```
Prima giravano su `iad1` (USA): ogni query attraversava l'Atlantico (~80 ms).
Verifica region attiva: l'header `x-vercel-id` di una API route deve mostrare `::dub1::`.

## Checklist rapida per ogni nuova pagina/loader
- [ ] Nessun `seed*()` non guardato nel render → usa `ensure*Seeded()`.
- [ ] Gli `await prisma` indipendenti sono in un `Promise.all`.
- [ ] Nessun `await` dentro un loop sul path di rendering (batch con `in`/`groupBy`).
- [ ] Le query selezionano solo i campi serventi (`select`) e hanno un `take` ragionevole.
