import {
  defaultAccountingAccount,
  normalizeClientAccountingCode,
  resolveAccountingAccount,
  resolveCounterpartyAccount,
} from "@/lib/finance-accounting-accounts";

describe("finance-accounting-accounts", () => {
  it("uses client accounting code when set", () => {
    expect(resolveAccountingAccount("INCOME", "EXPECTED", "4105999")).toBe("4105999");
  });

  it("falls back to defaults without client code", () => {
    expect(resolveAccountingAccount("INCOME", "RECEIVED", null)).toBe("5810");
    expect(resolveAccountingAccount("EXPENSE", "PLANNED", null)).toBe("2605");
  });

  it("normalizes valid codes", () => {
    expect(normalizeClientAccountingCode(" 4105abc ")).toBe("4105abc");
    expect(normalizeClientAccountingCode("x")).toBeNull();
  });

  it("defaultAccountingAccount respects type", () => {
    expect(defaultAccountingAccount("EXPENSE", "PAID")).toBe("6805");
  });

  it("resolveCounterpartyAccount uses bank for received income", () => {
    expect(resolveCounterpartyAccount("INCOME", "RECEIVED")).toBe("1801");
    expect(resolveCounterpartyAccount("EXPENSE", "PLANNED")).toBe("2605");
  });
});
