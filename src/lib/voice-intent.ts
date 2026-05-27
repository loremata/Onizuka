export type VoiceIntent =
  | { kind: "task"; title: string }
  | { kind: "memory"; content: string }
  | { kind: "completeTask"; query: string }
  | { kind: "navigate"; href: string; label: string }
  | { kind: "status" }
  | { kind: "unknown"; transcript: string };

import { stripOnizukaWakePrefix } from "@/lib/voice-wake";

export function parseVoiceTranscript(transcript: string): VoiceIntent {
  const t = stripOnizukaWakePrefix(transcript);
  if (!t) return { kind: "unknown", transcript };

  const taskMatch = t.match(
    /(?:onizuka[, ]+)?(?:ricordami di|crea(?:re)?\s+(?:un\s+)?task(?:\s+per)?|aggiungi\s+task)\s+(.+)/i
  );
  if (taskMatch?.[1]) {
    return { kind: "task", title: taskMatch[1].trim().slice(0, 200) };
  }

  const memoryMatch = t.match(
    /(?:onizuka[, ]+)?(?:salva\s+in\s+memoria|memorizza|nota\s+in\s+memoria)\s+(.+)/i
  );
  if (memoryMatch?.[1]) {
    return { kind: "memory", content: memoryMatch[1].trim().slice(0, 4000) };
  }

  const completeMatch = t.match(
    /(?:onizuka[, ]+)?(?:completa|segna\s+(?:come\s+)?(?:fatto|done)|chiudi)\s+(?:il\s+)?task\s+(.+)/i
  );
  if (completeMatch?.[1]) {
    return { kind: "completeTask", query: completeMatch[1].trim().slice(0, 120) };
  }

  if (/\breach\b/i.test(t) || /\bsequenz/i.test(t) || /\bfollow-?up\b/i.test(t)) {
    return { kind: "navigate", href: "/admin/reach/sequences", label: "Sequenze Reach" };
  }

  const openClient = t.match(/(?:apri|mostra|scheda)\s+(?:cliente\s+)?(.+)/i);
  if (openClient?.[1] && !/audit|finanz|recap|reach|sequenz/i.test(t)) {
    const q = encodeURIComponent(openClient[1].trim());
    return {
      kind: "navigate",
      href: `/admin/search?q=${q}`,
      label: `Cerca «${openClient[1].trim()}»`,
    };
  }

  if (
    /\b(quanti|quante)\s+task\b/i.test(t) ||
    /\btask\s+(oggi|in\s+ritardo|scadut)/i.test(t) ||
    /\bcosa\s+ho\s+(oggi|da\s+fare)/i.test(t) ||
    /\bsituazione\s+(oggi|operativa)/i.test(t)
  ) {
    return { kind: "status" };
  }

  if (/\brecap\b/i.test(t)) {
    return { kind: "navigate", href: "/admin/voice", label: "Recap vocale" };
  }

  if (
    /\b(inserisci|aggiungi|crea)\b.*\b(prospect|lead)\b/i.test(t) &&
    /\b(p\.?\s*iva|partita\s*iva|\d{11})\b/i.test(t)
  ) {
    return { kind: "navigate", href: "/admin/approvals", label: "Prospect da P.IVA (Approval Queue)" };
  }

  if (/\baudit\b/i.test(t) || /\bp\.?\s*iva\b/i.test(t)) {
    return { kind: "navigate", href: "/admin/audit/digital", label: "Audit digitale" };
  }

  if (/\bcross-?sell\b/i.test(t) || /\bupsell\b/i.test(t)) {
    return { kind: "navigate", href: "/admin/crm/cross-sell", label: "Cross-sell" };
  }

  if (/\bapproval\b/i.test(t) || /\bda\s+approvare\b/i.test(t)) {
    return { kind: "navigate", href: "/admin/approvals", label: "Approval Queue" };
  }

  if (/\bfinanz/i.test(t) || /\bcashflow\b/i.test(t)) {
    return { kind: "navigate", href: "/admin/finance", label: "Finance" };
  }

  if (/\bincass\w*\s+scadut/i.test(t) || /\binsolut/i.test(t)) {
    return { kind: "navigate", href: "/admin/finance", label: "Finance · scaduti" };
  }

  if (/\bflow\b/i.test(t) && /\b(ritard|scadut|overdue)\b/i.test(t)) {
    return { kind: "navigate", href: "/admin/flow?due=overdue", label: "Flow · in ritardo" };
  }

  if (/\bflow\b/i.test(t) || /\btask\b/i.test(t)) {
    return { kind: "navigate", href: "/admin/flow", label: "Flow" };
  }

  if (/\bmemori/i.test(t)) {
    return { kind: "navigate", href: "/admin/memory", label: "Memoria" };
  }

  if (t.length >= 8) {
    return { kind: "task", title: t.slice(0, 200) };
  }

  return { kind: "unknown", transcript: t };
}
