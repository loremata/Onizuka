export type AutonomyRisk = "low" | "medium" | "high";

export type AutonomyDecision = {
  allowed: boolean;
  risk: AutonomyRisk;
  reason: string;
};

const HIGH_RISK_PATTERNS = [
  /\belimin\w*/i,
  /\bcancell\w*/i,
  /\binvi\w*\s+(?:email|mail|reach)/i,
  /\bapprov\w*/i,
  /\bpag\w*\s+(?:fattur|invoice)/i,
  /\bpassword\b/i,
];

const MEDIUM_RISK_PATTERNS = [
  /\bcrea\w*\s+cliente/i,
  /\bconvert\w*\s+lead/i,
  /\baudit\b/i,
  /\bsequenz/i,
];

/** Policy MVP: solo navigazione e task sono low-risk; invii/approvazioni richiedono conferma UI. */
export function evaluateVoiceAutonomy(transcript: string): AutonomyDecision {
  const t = transcript.trim();
  if (!t) {
    return { allowed: false, risk: "high", reason: "Comando vuoto." };
  }

  for (const re of HIGH_RISK_PATTERNS) {
    if (re.test(t)) {
      return {
        allowed: false,
        risk: "high",
        reason: "Azione sensibile: esegui da interfaccia admin con conferma esplicita.",
      };
    }
  }

  for (const re of MEDIUM_RISK_PATTERNS) {
    if (re.test(t)) {
      return {
        allowed: true,
        risk: "medium",
        reason: "Suggerisco di verificare il modulo prima di confermare.",
      };
    }
  }

  if (/\bmemorizz|\bsalva\s+in\s+memoria\b/i.test(t)) {
    return {
      allowed: true,
      risk: "low",
      reason: "Nota in memoria episodica (bassa sensibilità).",
    };
  }

  if (/\bcompleta\b/i.test(t) && /\btask\b/i.test(t)) {
    return {
      allowed: true,
      risk: "low",
      reason: "Chiusura task propri del tuo Flow.",
    };
  }

  return {
    allowed: true,
    risk: "low",
    reason: "Task, memoria o navigazione consentiti da voice MVP.",
  };
}
