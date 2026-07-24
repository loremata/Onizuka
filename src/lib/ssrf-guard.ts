// Guardia SSRF: impedisce che URL derivati da input non fidato (lead, scraping)
// puntino a risorse interne / metadata cloud (127.0.0.1, 169.254.169.254, reti private…).
// Usa solo moduli Node core (dns), nessuna dipendenza esterna.
import { promises as dns } from "node:dns";
import net from "node:net";

/** Errore dedicato: il chiamante può distinguerlo da un normale fallimento di rete. */
export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

/** Hostname sempre vietati (loopback / suffissi interni). */
function isForbiddenHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, ""); // togli eventuale dot finale FQDN
  if (h === "localhost") return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  return false;
}

/** IPv4 in range privato / loopback / link-local / "this host". */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    // Non è un IPv4 valido: per prudenza lo trattiamo come da bloccare a monte.
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 (incluso 0.0.0.0)
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. 169.254.169.254 metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT (bonus prudenziale)
  return false;
}

/** Espande un IPv6 (anche in forma compressa) nei suoi 16 byte. Ritorna null se non valido. */
function ipv6ToBytes(ip: string): number[] | null {
  let addr = ip;
  // IPv6 con IPv4 embedded (::ffff:1.2.3.4) → lascia gestire i casi mappati sotto.
  const zoneless = addr.split("%")[0]; // togli zone id (fe80::1%eth0)
  addr = zoneless;

  const hasDoubleColon = addr.includes("::");
  const segments = addr.split("::");
  if (segments.length > 2) return null;

  const head = segments[0] ? segments[0].split(":") : [];
  const tail = segments.length === 2 && segments[1] ? segments[1].split(":") : [];

  // Gestione IPv4 embedded nell'ultimo gruppo.
  const expandGroup = (groups: string[]): number[] | null => {
    const out: number[] = [];
    for (const g of groups) {
      if (g.includes(".")) {
        const v4 = g.split(".").map((n) => Number(n));
        if (v4.length !== 4 || v4.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
        out.push(v4[0], v4[1], v4[2], v4[3]);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
        const val = parseInt(g, 16);
        out.push((val >> 8) & 0xff, val & 0xff);
      }
    }
    return out;
  };

  const headBytes = expandGroup(head);
  const tailBytes = expandGroup(tail);
  if (headBytes === null || tailBytes === null) return null;

  let bytes: number[];
  if (hasDoubleColon) {
    const missing = 16 - headBytes.length - tailBytes.length;
    if (missing < 0) return null;
    bytes = [...headBytes, ...new Array(missing).fill(0), ...tailBytes];
  } else {
    bytes = [...headBytes, ...tailBytes];
  }
  if (bytes.length !== 16) return null;
  return bytes;
}

/** IPv6 vietato: loopback ::1, ULA fc00::/7, link-local fe80::/10, unspecified ::, e IPv4-mapped privati. */
function isPrivateIPv6(ip: string): boolean {
  const bytes = ipv6ToBytes(ip);
  if (!bytes) return true; // non parsabile → blocca prudenzialmente

  // :: (unspecified) e ::1 (loopback)
  const allZeroExceptLast = bytes.slice(0, 15).every((b) => b === 0);
  if (allZeroExceptLast && (bytes[15] === 0 || bytes[15] === 1)) return true;

  // fc00::/7 (ULA): primi 7 bit = 1111 110x
  if ((bytes[0] & 0xfe) === 0xfc) return true;
  // fe80::/10 (link-local): primi 10 bit = 1111 1110 10
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;

  // IPv4-mapped ::ffff:a.b.c.d → valuta l'IPv4 sottostante.
  const isV4Mapped = bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  if (isV4Mapped) {
    const v4 = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
    return isPrivateIPv4(v4);
  }

  return false;
}

/** True se l'IP (v4 o v6) ricade in un range vietato. */
export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  // Non è un IP: non è competenza di questa funzione.
  return false;
}

/**
 * Verifica che `url` sia un URL http/https pubblico e sicuro da contattare.
 * - schema deve essere http o https;
 * - hostname non deve essere localhost/*.local/*.internal;
 * - se l'host è già un IP literal, deve essere pubblico;
 * - altrimenti risolve il DNS (tutte le famiglie) e TUTTI gli IP risolti devono essere pubblici
 *   (mitiga il DNS-rebinding sul primo hop).
 *
 * Lancia SsrfBlockedError se l'URL è vietato. Un fallimento DNS (dominio inesistente) viene
 * propagato come errore normale: il chiamante lo tratterà come un fetch fallito, non come crash.
 */
export async function assertPublicHttpUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfBlockedError(`URL non valido: ${url}`);
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:") {
    throw new SsrfBlockedError(`Schema non consentito: ${parsed.protocol}`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, ""); // togli le parentesi degli IPv6 letterali
  if (!host) throw new SsrfBlockedError("Host mancante nell'URL");

  if (isForbiddenHostname(host)) {
    throw new SsrfBlockedError(`Host interno non consentito: ${host}`);
  }

  // Host già IP literal: valuta direttamente senza DNS.
  if (net.isIP(host) !== 0) {
    if (isBlockedIp(host)) {
      throw new SsrfBlockedError(`IP privato/interno non consentito: ${host}`);
    }
    return;
  }

  // Risolvi tutti gli indirizzi (A + AAAA). `all: true` restituisce l'elenco completo.
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length) {
    throw new SsrfBlockedError(`DNS senza risultati per: ${host}`);
  }
  for (const rec of records) {
    if (isBlockedIp(rec.address)) {
      throw new SsrfBlockedError(
        `Host ${host} risolve a IP privato/interno (${rec.address})`
      );
    }
  }
}

/** Variante booleana comoda: true se l'URL è pubblico e sicuro, false altrimenti (mai lancia). */
export async function isPublicHttpUrl(url: string): Promise<boolean> {
  try {
    await assertPublicHttpUrl(url);
    return true;
  } catch {
    return false;
  }
}
