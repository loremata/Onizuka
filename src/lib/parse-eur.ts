import { Prisma } from "@prisma/client";

/**
 * Parser unico per importi in euro digitati a mano.
 *
 * Accetta sia il formato italiano ("1.500,00", "1.500", "1500,50") sia quello
 * inglese ("1500.50", "1,500.00"). Regola: quando c'è una sola virgola è SEMPRE
 * il separatore decimale ("1,500" vale 1,50 € — chi intende millecinquecento
 * scrive "1500" o "1.500"). Il vecchio `raw.replace(",", ".")` sostituiva solo
 * la prima virgola: "1.500,00" diventava NaN e il valore veniva azzerato.
 */
export function parseEurAmount(raw: string | null): Prisma.Decimal | null {
  const s = raw?.trim().replace(/[\s€]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    // Entrambi presenti: l'ultimo che compare è il separatore decimale.
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    normalized = s.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    normalized = s.replace(",", ".");
  } else if (lastDot >= 0) {
    // Solo punti: "1.500" sono migliaia, "1500.5" è decimale.
    const isThousands = s.split(".").slice(1).every((part) => part.length === 3);
    normalized = isThousands ? s.split(".").join("") : s;
  } else {
    normalized = s;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(n.toFixed(2));
}
