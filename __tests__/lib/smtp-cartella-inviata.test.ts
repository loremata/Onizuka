import { scegliCartellaInviata } from "@/lib/smtp-send";

/**
 * Sbagliare cartella significa archiviare in un posto che nessuno apre — cioè
 * ritrovarsi di nuovo con la "Posta inviata" vuota, che è il problema da cui
 * questa funzione nasce.
 */
describe("scegliCartellaInviata", () => {
  it("preferisce l'attributo standard al nome", () => {
    const scelta = scegliCartellaInviata([
      { path: "INBOX" },
      { path: "Archivio.Sentimenti" },
      { path: "INBOX.Sent", specialUse: "\Sent" },
    ]);
    expect(scelta).toBe("INBOX.Sent");
  });

  it("ripiega sul nome quando il server non dichiara l'uso speciale", () => {
    expect(scegliCartellaInviata([{ path: "INBOX" }, { path: "INBOX.Sent" }])).toBe("INBOX.Sent");
    expect(scegliCartellaInviata([{ path: "Posta inviata" }])).toBe("Posta inviata");
    expect(scegliCartellaInviata([{ path: "Sent" }])).toBe("Sent");
  });

  it("non scambia per posta inviata una cartella che ci somiglia", () => {
    expect(scegliCartellaInviata([{ path: "INBOX" }, { path: "Sentiti" }, { path: "Presentazioni" }])).toBeNull();
  });

  it("senza cartelle non inventa un percorso", () => {
    expect(scegliCartellaInviata([])).toBeNull();
  });
});
