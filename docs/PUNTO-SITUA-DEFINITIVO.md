# Punto della situa definitivo

## Ecosistema Online Station / Onizuka / Brand verticali

_Documento strategico canonico · Lorenzo Matarazzo · Online Station_

---

## 1. Principio centrale

> **Online Station** è il contenitore aziendale, commerciale e operativo.  
> **Onizuka** è il Business Operating System interno.  
> **Onizuka** è il clone operativo di Lorenzo.  
> **I brand verticali** sono asset commerciali autonomi, sotto l’ombrello Online Station.

### Decisione chiave

**StationHQ è eliminato completamente.**

Non è più: modulo, workspace, piattaforma, progetto separato, nome in UI, nome in documentazione funzionale.

Tutto è inglobato in **Onizuka**.

---

## 2. Architettura finale

```text
ONLINE STATION
azienda madre futura / hub commerciale / contenitore di tutto

│
├── Lorenzo Matarazzo — personal brand, autorevolezza, consulenza
├── LabSeven — siti web, SEO, infrastruttura digitale
├── StudioPop — social media, contenuti, creatività
├── DoctorLead — advertising, lead generation, performance
├── Brandity — branding, identità, posizionamento
├── Sito24Ore — sito rapido, prodotto entry-level
└── VaultAI — AI, automazioni, sistemi intelligenti per negozi, PMI

ONIZUKA
Business Operating System interno · clone operativo di Lorenzo
non pubblico · non vendibile · non SaaS · piattaforma unica centrale
```

---

## 3. Ruolo dei blocchi

| Elemento | Ruolo |
|----------|--------|
| **Online Station** | Azienda madre futura, hub commerciale e operativo |
| **Lorenzo Matarazzo** | Personal brand, fiducia, consulenza |
| **Onizuka** | BOS interno e clone operativo |
| **LabSeven** | Siti, SEO, web |
| **StudioPop** | Social, contenuti |
| **DoctorLead** | Ads, funnel, lead gen |
| **Brandity** | Branding, identità |
| **Sito24Ore** | Sito veloce entry-level |
| **VaultAI** | AI e automazioni (linea commerciale) |

---

## 4. Regola definitiva

```text
Brand fuori.
Onizuka dentro.
Online Station sopra.
Lorenzo al comando.
```

Operativo:

> Tutto ciò che comunica al mercato passa dai **brand**.  
> Tutto ciò che gestisce dati, clienti, processi, automazioni e memoria passa da **Onizuka**.  
> Tutto ciò che fattura, nel disegno finale, passa sotto **Online Station**.

---

## 5. Online Station

**Ruolo:** contenitore aziendale → futura **Online Station S.r.l.**

**Vende e coordina:**

- **Servizi negozio:** mobile, fibra, luce, gas, streaming, TV, Sky, TIM Vision, retail
- **Servizi digitali / AI:** siti, SEO, social, ads, lead gen, branding, automazioni, AI, consulenza, manutenzioni, rinnovi

**Percorsi commerciali:**

```text
Online Station
├── Privati
└── Aziende / Attività / PMI
```

---

## 6. Onizuka

**Definizione:** Business Operating System interno di Lorenzo e Online Station — **clone operativo di Lorenzo**.

**Onizuka non è:** prodotto pubblico, SaaS, brand commerciale, CRM generico, assistente decorativo.

**Onizuka deve:** ricordare, follow-up, prospect/clienti, audit, report, proposte, email in approvazione, follow-up schedulati, rinnovi 12 mesi, upsell/cross-sell — **fatturare**.

---

## 7. Nomi obsoleti (vietati in UI)

StationHQ · SINFONIA · DRAKKAR · OPERA · SKALD · OUVERTURE · MAESTRO

| Vecchio | In Onizuka |
|---------|------------|
| StationHQ | eliminato |
| DRAKKAR | scouting / prospecting |
| OPERA | audit digitale |
| SKALD | outreach / follow-up |
| OUVERTURE | content / social workflow |
| MAESTRO | orchestrazione workflow |
| SINFONIA | assorbito |

---

## 8. Brand verticali

Ogni brand: sito, social, tono, offerte, funnel, template — **gestiti dentro Onizuka**.

Vedi seed: `src/lib/commercial-catalog-seed.ts` (`ECOSYSTEM_BRANDS`).

---

## 9. VaultAI

Linea AI dell’ecosistema. Target: negozi, locali, professionisti, PMI.

> **Onizuka = laboratorio interno.**  
> **VaultAI = capability commerciali derivate al mercato.**

---

## 10. Clienti in Onizuka

```text
Cliente
├── Privato (codice fiscale)
└── Azienda (P.IVA, referenti)
```

Relazione: **Persona privata ↔ Azienda** — entità `Person` + `PersonClientRole` (sync da `ClientContact`); vista `/admin/crm/people`.

---

## 11. Macro-categorie servizi

1. **Cliente Negozio** — mobile, SIM, fibra, luce, gas, streaming, TV, Sky, …
2. **Cliente Digitale / AI** — sito, SEO, social, ads, branding, automazioni, AI, …

---

## 12. Cross-sell / upsell (esempi query)

- Clienti StudioPop con social **senza** DoctorLead Ads
- Clienti fibra TIM **senza** TIM Vision
- Clienti sito acquistato **12 mesi fa** → rinnovo / SEO / ads
- Aziende negozio **senza** servizi digitali attivi

---

## 13. Workflow prospect da P.IVA (target)

Comando: *«Onizuka, inserisci come prospect per servizi digitali/AI questa partita IVA XXX»*

Flusso: intent → P.IVA → dedupe → scheda azienda → audit → report PDF → proposta → brand → email in **Approval Queue** → approvazione Lorenzo → invio → follow-up 7gg → timeline.

---

## 14. Stati commerciali (target)

**Prospect:** inserito → audit → report → proposta → approvazione → mail → follow-up → call → preventivo → vinto/perso/nurturing.

**Cliente attivo:** onboarding → in corso → manutenzione → rinnovo → a rischio → riattivabile.

**Rinnovi:** 90/60/30/15/7 giorni, upsell/cross-sell possibile.

---

## 15. Moduli Onizuka

Command Center · CRM · Pipeline · Audit digitale · Proposte · Contratti/rinnovi · Delivery · Ticket · Client Portal · Documenti · Automazioni · AI Assistant · Knowledge base · Economics · Reporting · Calendario · Content · Brand/offerte · Partner · Impostazioni · **Approval Queue**

---

## 16. Approval Queue

L’AI prepara; Lorenzo approva; Onizuka esegue.

Coda: email, proposte, follow-up, offerte, invii. Azioni: Approva · Modifica · Rigenera · Rifiuta · Schedula · Invia.

_Oggi in codice: bozze outreach (`/admin/reach`), preventivi, Action Inbox — da unificare sotto label «Approval Queue»._

---

## 17. Google Sheet

```text
Google Sheet = staging grezzo
Onizuka = dati validati e opportunità vere
```

Coda audit sheet: `AuditSheetQueueItem` + cron `audit-sheet-queue`.

---

## 18. Criterio di completamento (20 punti)

Vedi [CURSOR-CHECKLIST-ONIZUKA.md](./CURSOR-CHECKLIST-ONIZUKA.md) e [GAP-VS-PUNTO-SITUA.md](./GAP-VS-PUNTO-SITUA.md).

---

## 19. Sintesi finale

```text
Online Station = azienda madre e contenitore commerciale
Lorenzo Matarazzo = volto e consulenza
Brand verticali = linee commerciali
VaultAI = linea AI commerciale
Onizuka = cervello interno unico
Google Sheet = staging
n8n / API / AI / Supabase / Drive / Gmail = infrastruttura
```

> Non tanti progetti separati: un ecosistema multi-brand governato da **Onizuka**.

---

## Documenti collegati

| File | Uso |
|------|-----|
| [CURSOR-CHECKLIST-ONIZUKA.md](./CURSOR-CHECKLIST-ONIZUKA.md) | Checklist implementazione per Cursor |
| [GAP-VS-PUNTO-SITUA.md](./GAP-VS-PUNTO-SITUA.md) | Cosa c’è già nel codice vs target |
| [ONIZUKA_MASTER_SPEC.md](./ONIZUKA_MASTER_SPEC.md) | Spec tecnica moduli |
| [ROADMAP-MIGLIORAMENTI.md](./ROADMAP-MIGLIORAMENTI.md) | Roadmap evolutiva |
