// Normalizzazioni condivise per il matching/dedup delle aziende.

const FORME = /\b(s\.?r\.?l\.?s?|s\.?n\.?c|s\.?a\.?s|s\.?p\.?a|soc\.?|societa'?|cooperativa|scarl|coop|ss|sc)\b/g;

function stripAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Nome azienda comparabile: senza accenti, forme societarie, punteggiatura.
export function normName(s = ""): string {
  return stripAccents(s)
    .replace(FORME, " ")
    .replace(/\b(di|the|il|la|lo|le|gli|i|e|del|della|dei|degli|delle)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// "Core" indirizzo: via + numero civico (senza tipo via e senza località/CAP).
export function normAddrStreet(s = ""): string {
  return stripAccents(s)
    .replace(/\b(via|viale|v\.le|piazza|p\.?za|largo|l\.go|corso|c\.so|vicolo|strada|localita|loc|fraz|frazione|borgo)\b\.?/g, " ")
    .replace(/\b\d{5}\b/g, " ") // toglie il CAP
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Telefono italiano a sole cifre (senza +39). Ripiega numeri duplicati.
export function normPhone(s = ""): string {
  let d = (s || "").replace(/\D/g, "");
  if (d.startsWith("39") && d.length > 10) d = d.slice(2);
  if (d.length >= 12 && d.length % 2 === 0) {
    const half = d.length / 2;
    if (d.slice(0, half) === d.slice(half)) d = d.slice(0, half);
  }
  return d;
}

// Dominio "core" di un sito (senza www, path, protocollo): per dedup su sito.
export function siteDomain(url = ""): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `http://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

// Token significativi (>3 char) di una stringa normalizzata.
export function tokens(s = ""): Set<string> {
  return new Set(s.split(" ").filter((t) => t.length > 3));
}

// Similarità Jaccard grezza tra due nomi normalizzati.
export function nameSim(a = "", b = ""): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = a.split(" ").filter(Boolean);
  const tb = new Set(b.split(" ").filter(Boolean));
  if (!ta.length || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.length, tb.size);
}
