# Script one-shot del modulo Inserimenti — ARCHIVIO STORICO

Questi script hanno costruito lo stato iniziale del modulo (luglio 2026) e
sono SUPERATI: da quando il modulo è in produzione su onizuka.it (23/07/2026),
la fonte di verità sono il DB di produzione e le pagine del modulo
(Registra, Listino, Piani). Restano qui solo come documentazione di come i
dati sono stati costruiti.

⚠️ NON rilanciare `import-inserimenti-foglio.ts`: CANCELLA tutte le vendite
del mese (anche quelle inserite a mano) e le ricrea dal CSV dell'epoca.

Ancora attivi (fuori da questo archivio):
- `scripts/seed-inserimenti.ts` — ricrea i piani dal seed in codice (dev).
- `scripts/verify-inserimenti.ts` — verifica end-to-end DB → motore (dev).
