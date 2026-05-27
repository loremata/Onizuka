import { Prisma } from "@prisma/client";
import { formatFiscalUniqueViolation, isFiscalUniqueConstraintError } from "@/lib/fiscal-unique-error";

function p2002(target: string | string[], message = "") {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: "P2002",
    clientVersion: "5.22.0",
    meta: { target },
  });
}

describe("fiscal-unique-error", () => {
  it("maps Client VAT index to operational message", () => {
    const msg = formatFiscalUniqueViolation(p2002(["Client_vatNumber_norm_unique"]));
    expect(msg).toMatch(/Partita IVA/i);
    expect(msg).not.toMatch(/Unique constraint/i);
  });

  it("maps Client fiscalCode index", () => {
    const msg = formatFiscalUniqueViolation(p2002("Client_fiscalCode_norm_unique"));
    expect(msg).toMatch(/codice fiscale/i);
  });

  it("maps Person fiscalCode index", () => {
    const msg = formatFiscalUniqueViolation(p2002(["ownerUserId", "fiscalCode"], "Person_owner_fiscalCode_norm_unique"));
    expect(msg).toMatch(/persona/i);
  });

  it("returns null for unrelated P2002", () => {
    expect(formatFiscalUniqueViolation(p2002(["slug"]))).toBeNull();
    expect(isFiscalUniqueConstraintError(p2002(["slug"]))).toBe(false);
  });
});
