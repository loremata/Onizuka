// Genera lo slug di registroaziende.it per un comune, con candidati di fallback.
// Regola primaria verificata: minuscolo, accenti rimossi, APOSTROFI RIMOSSI,
// resto -> trattino. Es. "Rosignano Marittimo"/"Livorno" -> rosignano-marittimo-livorno,
// "L'Aquila"/"L'Aquila" -> laquila-laquila, "Reggio nell'Emilia" -> reggio-nellemilia-...

function base(x: string): string {
  return x
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Variante primaria: apostrofo rimosso.
function slugNoApos(x: string): string {
  return base(x).replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Variante di fallback: apostrofo -> trattino.
function slugAposDash(x: string): string {
  return base(x).replace(/['’`]/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Ritorna i candidati slug da provare in ordine (il worker verifica quale funziona).
export function registroSlugCandidates(comune: string, provincia: string): string[] {
  const cand = new Set<string>();
  cand.add(`${slugNoApos(comune)}-${slugNoApos(provincia)}`);
  cand.add(`${slugAposDash(comune)}-${slugAposDash(provincia)}`);
  return Array.from(cand);
}

// Slug primario (quello salvato nel dataset).
export function registroSlug(comune: string, provincia: string): string {
  return `${slugNoApos(comune)}-${slugNoApos(provincia)}`;
}
