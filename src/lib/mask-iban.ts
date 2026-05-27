/** Maschera IBAN per visualizzazione portale (ultimi 4 visibili). */
export function maskIban(iban: string | null | undefined): string | null {
  const s = iban?.replace(/\s/g, "").toUpperCase();
  if (!s || s.length < 8) return null;
  return `${s.slice(0, 4)} **** **** ${s.slice(-4)}`;
}
