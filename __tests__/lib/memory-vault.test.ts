import {
  getMemoryVaultStatus,
  isMemoryVaultPinConfigured,
  verifyMemoryVaultPin,
} from "@/lib/memory-vault";

describe("memory-vault", () => {
  const prevPin = process.env.ONIZUKA_MEMORY_VAULT_PIN;
  const prevKey = process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY;

  afterEach(() => {
    if (prevPin === undefined) delete process.env.ONIZUKA_MEMORY_VAULT_PIN;
    else process.env.ONIZUKA_MEMORY_VAULT_PIN = prevPin;
    if (prevKey === undefined) delete process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY;
    else process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY = prevKey;
  });

  it("detects vault pin configured", () => {
    process.env.ONIZUKA_MEMORY_VAULT_PIN = "secret-pin";
    expect(isMemoryVaultPinConfigured()).toBe(true);
  });

  it("verifies pin with timing-safe compare", () => {
    process.env.ONIZUKA_MEMORY_VAULT_PIN = "abc123";
    expect(verifyMemoryVaultPin("abc123")).toBe(true);
    expect(verifyMemoryVaultPin("wrong")).toBe(false);
  });

  it("skips pin check when not configured", () => {
    delete process.env.ONIZUKA_MEMORY_VAULT_PIN;
    expect(verifyMemoryVaultPin(null)).toBe(true);
  });

  it("reports vault status", () => {
    process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY = "a-long-test-key-12345";
    const status = getMemoryVaultStatus();
    expect(status.encryptionEnabled).toBe(true);
  });
});
