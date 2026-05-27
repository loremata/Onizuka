/** Bridge verso SDI / intermediario (Aruba, Fatture in Cloud, …). MVP: tracciamento export manuale. */

export function isSdiBridgeConfigured(): boolean {
  return Boolean(process.env.ONIZUKA_SDI_ENDPOINT?.trim());
}

export function sdiBridgeHint(): string {
  if (isSdiBridgeConfigured()) {
    return "Endpoint SDI configurato: invio automatico in roadmap.";
  }
  return "Configura ONIZUKA_SDI_ENDPOINT per invio automatico; oggi segna export XML come inviato.";
}
