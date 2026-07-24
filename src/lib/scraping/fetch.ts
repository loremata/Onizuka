// Download pagine via curl (curl.exe nativo Win10+ / curl su unix).
// Necessario perché registroaziende & simili bloccano il fingerprint TLS di
// Node/undici (403), mentre curl passa. Retry con backoff su 429/403/5xx.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertPublicHttpUrl } from "../ssrf-guard";

const execFileP = promisify(execFile);
const SENTINEL = "\n__HTTPSTATUS__:";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchResult {
  ok: boolean;
  status: number;
  html: string;
  error?: string;
}

export async function fetchViaCurl(url: string, tentativi = 4): Promise<FetchResult> {
  // Guardia SSRF: valida l'URL iniziale prima di invocare curl. curl segue i redirect
  // (-sL) quindi limitiamo anche il numero di hop e i protocolli ammessi.
  try {
    await assertPublicHttpUrl(url);
  } catch (err) {
    return { ok: false, status: 0, html: "", error: `SSRF bloccato: ${String(err)}` };
  }

  let ultimoErr = "";
  for (let i = 0; i < tentativi; i++) {
    try {
      const { stdout } = await execFileP(
        "curl",
        [
          "-sL", "--compressed", "--max-time", "30",
          "--max-redirs", "5", "--proto", "=http,https",
          "-A", UA,
          "-H", "Accept-Language: it-IT,it;q=0.9",
          "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "-w", SENTINEL + "%{http_code}",
          url,
        ],
        { maxBuffer: 32 * 1024 * 1024, windowsHide: true }
      );
      const cut = stdout.lastIndexOf(SENTINEL);
      const html = cut >= 0 ? stdout.slice(0, cut) : stdout;
      const status = cut >= 0 ? parseInt(stdout.slice(cut + SENTINEL.length), 10) : 0;

      if (status === 429 || status === 403 || status >= 500) {
        ultimoErr = `HTTP ${status}`;
        if (i < tentativi - 1) await sleep(5000 * Math.pow(3, i)); // 5s,15s,45s
        continue;
      }
      if (status < 200 || status >= 300) return { ok: false, status, html: "" };
      return { ok: true, status, html };
    } catch (err) {
      ultimoErr = String(err);
      if (i < tentativi - 1) await sleep(2000 * Math.pow(2, i));
    }
  }
  return { ok: false, status: 0, html: "", error: ultimoErr };
}
