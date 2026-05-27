import { gateMemoryExport, isUnmaskedMemoryExportAllowed } from "@/lib/memory-export-policy";

describe("memory-export-policy", () => {
  const prev = process.env.ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT;

  afterEach(() => {
    if (prev === undefined) delete process.env.ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT;
    else process.env.ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT = prev;
  });

  it("allows masked export by default", () => {
    const gate = gateMemoryExport(new URLSearchParams({ maskSensitive: "1" }));
    expect(gate).toEqual({ allowed: true, maskSensitive: true });
  });

  it("requires confirm for unmasked", () => {
    const gate = gateMemoryExport(new URLSearchParams({ maskSensitive: "0" }));
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.status).toBe(400);
  });

  it("allows unmasked with confirm", () => {
    const gate = gateMemoryExport(
      new URLSearchParams({ maskSensitive: "0", confirm: "1" })
    );
    expect(gate).toEqual({ allowed: true, maskSensitive: false });
  });

  it("requires vault pin when configured", () => {
    process.env.ONIZUKA_MEMORY_VAULT_PIN = "vault-secret";
    const gate = gateMemoryExport(
      new URLSearchParams({ maskSensitive: "0", confirm: "1" })
    );
    expect(gate.allowed).toBe(false);
    const ok = gateMemoryExport(
      new URLSearchParams({ maskSensitive: "0", confirm: "1", vaultPin: "vault-secret" })
    );
    expect(ok).toEqual({ allowed: true, maskSensitive: false });
    delete process.env.ONIZUKA_MEMORY_VAULT_PIN;
  });

  it("respects kill switch env", () => {
    process.env.ONIZUKA_ALLOW_UNMASKED_MEMORY_EXPORT = "0";
    expect(isUnmaskedMemoryExportAllowed()).toBe(false);
    const gate = gateMemoryExport(
      new URLSearchParams({ maskSensitive: "0", confirm: "1" })
    );
    expect(gate.allowed).toBe(false);
  });
});
