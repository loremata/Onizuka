jest.mock("@/lib/prisma", () => ({
  prisma: { emailBounce: { findUnique: jest.fn(), upsert: jest.fn() } },
}));

import { parseBounce, sembraBounce } from "@/lib/outreach-bounce";

// Sorgenti presi dalla forma reale delle notifiche di mancata consegna: Postfix
// (DSN standard), Exim (Hostinger), e il caso della casella piena, che NON deve
// bruciare l'indirizzo.
const POSTFIX = [
  "From: MAILER-DAEMON@hostinger.com",
  "Subject: Undelivered Mail Returned to Sender",
  "Content-Type: multipart/report; report-type=delivery-status",
  "",
  "This is the mail system at host mail.hostinger.com.",
  "",
  "Final-Recipient: rfc822; info@pizzeriachiusa.it",
  "Original-Recipient: rfc822;info@pizzeriachiusa.it",
  "Action: failed",
  "Status: 5.1.1",
  "Diagnostic-Code: smtp; 550 5.1.1 <info@pizzeriachiusa.it>: Recipient address rejected: User unknown in virtual mailbox table",
  "",
  "From: Lorenzo <lorenzo@onlinestation.it>",
  "To: info@pizzeriachiusa.it",
].join("\r\n");

const EXIM = [
  "From: Mail Delivery System <Mailer-Daemon@srv.hostinger.com>",
  "Subject: Mail delivery failed: returning message to sender",
  "",
  "This message was created automatically by mail delivery software.",
  "",
  "A message that you sent could not be delivered to one or more of its recipients.",
  "",
  "  amministrazione@bottegavecchia.it",
  "    host mail.bottegavecchia.it [93.0.0.1]",
  "    SMTP error from remote mail server after RCPT TO:<amministrazione@bottegavecchia.it>:",
  "    550 No Such User Here",
].join("\r\n");

const CASELLA_PIENA = [
  "From: MAILER-DAEMON@hostinger.com",
  "Subject: Undelivered Mail Returned to Sender",
  "",
  "Final-Recipient: rfc822; titolare@barpieno.it",
  "Action: failed",
  "Status: 5.2.2",
  "Diagnostic-Code: smtp; 552 5.2.2 Mailbox full / over quota",
].join("\r\n");

const RITARDO = [
  "From: postmaster@hostinger.com",
  "Subject: Delivery Status Notification (Delay)",
  "",
  "Final-Recipient: rfc822; info@lentissimi.it",
  "Action: delayed",
  "Status: 4.4.1",
  "Diagnostic-Code: smtp; 421 4.4.1 Connection timed out",
].join("\r\n");

describe("sembraBounce", () => {
  it("riconosce il MAILER-DAEMON e gli oggetti di mancata consegna", () => {
    expect(sembraBounce("mailer-daemon@hostinger.com", "qualsiasi cosa")).toBe(true);
    expect(sembraBounce("noreply@sconosciuto.it", "Undelivered Mail Returned to Sender")).toBe(true);
    expect(sembraBounce("postmaster@srv.it", "Delivery Status Notification (Failure)")).toBe(true);
  });

  it("non scambia per rimbalzo una risposta vera", () => {
    // È il falso positivo che conta: un prospect che risponde non deve finire
    // tra i recapiti bruciati.
    expect(sembraBounce("mario@pizzeria.it", "Re: due parole sul vostro sito")).toBe(false);
    expect(sembraBounce("info@hotel.it", "Richiesta informazioni")).toBe(false);
  });
});

describe("parseBounce", () => {
  it("legge il destinatario e il codice dal DSN standard (Postfix)", () => {
    const p = parseBounce(POSTFIX, ["lorenzo@onlinestation.it"]);
    expect(p).not.toBeNull();
    expect(p?.email).toBe("info@pizzeriachiusa.it");
    expect(p?.permanent).toBe(true);
    expect(p?.code).toBe("5.1.1");
    expect(p?.reason).toContain("User unknown");
  });

  it("legge il RCPT TO rifiutato quando il DSN non c'è (Exim)", () => {
    const p = parseBounce(EXIM, ["lorenzo@onlinestation.it"]);
    expect(p?.email).toBe("amministrazione@bottegavecchia.it");
    expect(p?.permanent).toBe(true);
  });

  it("non brucia l'indirizzo se la casella è solo piena", () => {
    const p = parseBounce(CASELLA_PIENA);
    expect(p?.email).toBe("titolare@barpieno.it");
    expect(p?.permanent).toBe(false);
  });

  it("tratta il 4.x.x come temporaneo", () => {
    const p = parseBounce(RITARDO);
    expect(p?.email).toBe("info@lentissimi.it");
    expect(p?.permanent).toBe(false);
  });

  it("non restituisce mai il nostro stesso indirizzo", () => {
    // Il corpo del rimbalzo cita l'intestazione del messaggio originale: senza
    // l'esclusione ci si auto-bloccherebbe il mittente.
    const p = parseBounce(POSTFIX, ["lorenzo@onlinestation.it"]);
    expect(p?.email).not.toBe("lorenzo@onlinestation.it");
  });

  it("su un testo che non è un rimbalzo non inventa destinatari", () => {
    expect(parseBounce("Buongiorno, ci interessa. Chiamatemi al 320…")).toBeNull();
  });
});
