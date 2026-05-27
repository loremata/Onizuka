import { FINANCE_LONG_TERM_TARGET_EUR, FINANCE_MONTHLY_TARGET_EUR } from "@/lib/finance-ledger-stats";

describe("finance ledger targets", () => {
  it("matches master spec monthly goals", () => {
    expect(FINANCE_MONTHLY_TARGET_EUR).toBe(5000);
    expect(FINANCE_LONG_TERM_TARGET_EUR).toBe(10000);
  });
});
