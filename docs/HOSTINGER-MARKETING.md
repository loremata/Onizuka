# Sito marketing (Hostinger) + app Onizuka (Vercel)

Architettura consigliata per **onizuka.it**:

| Destinazione | Contenuto | DNS |
|--------------|-----------|-----|
| `https://onizuka.it` | App Next.js (Vercel) | A record → Vercel |
| `https://www.onizuka.it` | Redirect 301 → apex (`ONIZUKA_PRIMARY_HOST`) | CNAME Vercel |
| `https://landing.onizuka.it` (opzionale) | WordPress / Elementor su Hostinger | CNAME Hostinger |

## Hostinger (solo marketing)

1. Crea sottodominio `landing` (o usa dominio secondario) nel pannello Hostinger.
2. Installa WordPress o carica HTML statici da `../Onizuka-materiali-esterni/marketing-hostinger-html/`.
3. **Non** puntare il record A di `@` a Hostinger se l’app vive su Vercel.

Checklist app: [PASSI-MANCANTI.md](../PASSI-MANCANTI.md) · deploy: [DEPLOY.md](./DEPLOY.md).

## Link dall’app

Imposta opzionale:

```env
ONIZUKA_MARKETING_URL=https://landing.onizuka.it
```

Usabile in footer / email (futuro componente sito pubblico).

## File legali (cartella archivio)

In `../Onizuka-materiali-esterni/marketing-hostinger-html/`: `index.html`, `privacy-policy.html`, `termini-e-condizioni.html`, ecc. — da copiare su Hostinger come sito vetrina.
