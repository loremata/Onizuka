# 🛰️ Onizuka Radar — modulo acquisizione automatica

Pipeline: **audit → scoring → email outreach → follow-up → opportunità**, alimentata da Google Sheet o da singolo prospect. Brand verso il cliente: **Online Station** (Onizuka resta interno).

---

## 1. Come si avvia un audit

| Modo | Dove | Note |
|------|------|------|
| Da scheda cliente | `/admin/clients/[id]` → "Audit digitale" | Usa nome+città reali → migliori dati Google |
| Da form P.IVA | `/admin/audit/digital` | Compilare **sempre la Ragione sociale**, non solo la P.IVA |
| Da Google Sheet | pannello "Coda Google Sheet" + cron 06:00 UTC | Lavorazione massiva (cuore della pipeline) |

## 2. Cosa fa (pipeline)

1. **Probe sito** (HTTP + sottopagine): https, form, CTA, social, Maps, robots/sitemap, tempi
2. **Google Places**: rating + recensioni reali (se nome azienda + città corretti)
3. **Scoring** 0–100 su 10 aree: Sito, SEO, Local, Recensioni, Social, Adv, UX, Conversione, Tracking, Brand
4. **Strategia**: servizio primario + 2 secondari + prezzi (`src/lib/service-pricing.ts`)
5. **Bozza email** personalizzata (lacuna→problema→soluzione) in `/admin/approvals`
6. **Sequenza follow-up**: J+0 / J+3 / J+7 / J+14 / J+30
7. **PDF report** interno + cliente (brandizzati Online Station) su storage S3
8. **(Da Sheet)** scrive risultati nelle colonne: Score · Stato · Servizio primario · Prezzo · Secondari · Data

## 3. Flusso operativo

```
Google Sheet → Importa + Elabora (o cron 06:00 UTC)
  → Audit + scoring + colonne foglio aggiornate + scheda cliente aggiornata
  → /admin/approvals: leggi / modifica / archivia bozza → Invia (Online Station)
  → Follow-up J+3…J+30 (nuove bozze in coda)
  → Prospect risponde → "Ha risposto" (/admin/reach/sequences) → ferma sequenza + Opportunità
```

## 4. Loop di aggiornamento (sheet ↔ Onizuka)

- Modifichi una riga sul foglio (es. aggiungi il sito) → **Importa da Sheet** rileva il cambio (`updated`) → **Elabora** rifà l'audit
- Il re-audit: **sovrascrive** l'audit precedente (uno per azienda), **aggiorna la scheda cliente** (`enrichClient`) e **riscrive le colonne risultato** sul foglio
- Il cron giornaliero (06:00 UTC) fa tutto questo in automatico

## 5. Regole attive

- **Un solo audit per azienda** (re-audit sovrascrive)
- **Brand**: cliente vede solo Online Station; nessun "Onizuka" nelle email/PDF cliente
- **Invio** da `commerciale@onlinestation.it` (SMTP Hostinger)
- **Fuso** Europe/Rome ovunque

---

## ⚠️ Casi limite

| Caso | Comportamento | Gestione |
|------|---------------|----------|
| Prospect senza sito | Sezione sito bassa | Aggiungi sito poi → re-import → re-audit |
| Audit da P.IVA senza ragione sociale | "Prospect P.IVA…" → Google non trova | Compila sempre la Ragione sociale |
| Nome non su Google | ZERO_RESULTS, niente rating | Nome esatto come su Maps + città |
| Riga foglio modificata | `updated` → ri-audita | Importa + Elabora (o cron) |
| Sito aggiunto a riga senza P.IVA | Cambia chiave → re-audit + record orfano (innocuo) | Tenere la P.IVA dove possibile |
| Service account Viewer | Audit ok, colonne foglio vuote | Condividere foglio col SA come **Editor** |
| Tab foglio ≠ "Sheet1" | Errore range | `GOOGLE_SHEET_AUDIT_RANGE=NomeTab!A:Z` |
| Prospect risponde | Non rilevato in automatico | "Ha risposto" sulla sequenza |
| Audit vecchi/test | Restano in lista | Pulsante **Elimina** |
| Volume email | Dipende dalla reputazione | ~10/giorno in warm-up, poi su |
| PDF su Drive | Disabilitato (Gmail personale) | PDF su S3, scaricabili dai pulsanti |

## Limiti noti

- Risposte email non tracciate in automatico (aperture/click sì, in `/admin/reach`)
- Trigger real-time onEdit del foglio non attivo (cron giornaliero copre; immediato con Importa+Elabora)
- Upload PDF su Drive richiede Google Workspace (Shared Drive)

---

## Env rilevanti

| Variabile | Uso |
|-----------|-----|
| `GMAIL_SMTP_*` | Invio email (Online Station / Hostinger) |
| `GOOGLE_PLACES_API_KEY` | Rating/recensioni audit |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON` | Service account (Sheets + Drive) |
| `GOOGLE_SHEET_AUDIT_SPREADSHEET_ID` | Foglio coda audit |
| `GOOGLE_SHEET_AUDIT_RANGE` | Tab!A:Z (se tab ≠ Sheet1) |
| `GOOGLE_SHEET_AUTO_SYNC_CRON=1` | Sync automatica nel cron |
| `ONIZUKA_DRIVE_AUDIT_UPLOAD=1` | Riabilita upload PDF su Drive (serve Shared Drive) |

Cron Vercel (`vercel.json`): notifications 06:00 · webhook-retry */15 · reach-sequences 08:00 · audit-sheet-queue 06:00.

---

## Roadmap (visione "database unico + campagne")

Obiettivo: un database unico di tutti i clienti (privati + aziende) con filtri su qualsiasi attributo, interfacciato con tutto Onizuka, per massimizzare vendite, up-sell e cross-sell tramite campagne mirate (email/WhatsApp) anche guidate in linguaggio naturale. Vedi discussione dedicata.
