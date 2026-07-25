import { createHmac } from "node:crypto";
import { verifyWhatsAppSignature } from "@/lib/whatsapp-webhook";

/**
 * Comportamento di sicurezza del webhook WhatsApp: fail-closed.
 * Senza WHATSAPP_APP_SECRET la firma NON è verificabile → rifiuto.
 * Con il secret, accetta solo la firma HMAC-SHA256 corretta.
 */
describe("verifyWhatsAppSignature (fail-closed)", () => {
  const OLD = process.env.WHATSAPP_APP_SECRET;
  const body = JSON.stringify({ entry: [{ changes: [] }] });

  afterEach(() => {
    if (OLD === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = OLD;
  });

  it("rifiuta quando il secret non è configurato (anche con firma presente)", () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const sig = "sha256=" + createHmac("sha256", "qualsiasi").update(body).digest("hex");
    expect(verifyWhatsAppSignature(body, sig)).toBe(false);
    expect(verifyWhatsAppSignature(body, null)).toBe(false);
  });

  it("rifiuta con secret configurato ma firma assente o errata", () => {
    process.env.WHATSAPP_APP_SECRET = "secret-di-test";
    expect(verifyWhatsAppSignature(body, null)).toBe(false);
    expect(verifyWhatsAppSignature(body, "sha256=deadbeef")).toBe(false);
    const wrong = "sha256=" + createHmac("sha256", "altro-secret").update(body).digest("hex");
    expect(verifyWhatsAppSignature(body, wrong)).toBe(false);
  });

  it("accetta la firma HMAC corretta con il prefisso sha256=", () => {
    process.env.WHATSAPP_APP_SECRET = "secret-di-test";
    const good = "sha256=" + createHmac("sha256", "secret-di-test").update(body).digest("hex");
    expect(verifyWhatsAppSignature(body, good)).toBe(true);
  });
});
