import {
  encryptMemoryContent,
  decryptMemoryContent,
  isMemoryEncryptionEnabled,
} from "@/lib/memory-crypto";

describe("memory-crypto", () => {
  const prev = process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY = "test-key-min-16-chars!!";
  });

  afterAll(() => {
    process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY = prev;
  });

  it("encrypts and decrypts roundtrip", () => {
    expect(isMemoryEncryptionEnabled()).toBe(true);
    const { content, contentEncrypted } = encryptMemoryContent("segreto cliente");
    expect(contentEncrypted).toBe(true);
    expect(content.startsWith("enc:v1:")).toBe(true);
    expect(decryptMemoryContent(content, true)).toBe("segreto cliente");
  });
});
