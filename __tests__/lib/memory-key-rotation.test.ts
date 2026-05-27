import { decryptMemoryContent, encryptMemoryContent } from "@/lib/memory-crypto";

describe("memory key rotation decrypt", () => {
  const prevCurrent = process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY;
  const prevPrevious = process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY_PREVIOUS;

  afterEach(() => {
    if (prevCurrent === undefined) delete process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY;
    else process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY = prevCurrent;
    if (prevPrevious === undefined) delete process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY_PREVIOUS;
    else process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY_PREVIOUS = prevPrevious;
  });

  it("decrypts with previous key after rotation", () => {
    process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY = "old-key-min-16-chars!";
    const { content } = encryptMemoryContent("legacy secret");

    process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY = "new-key-min-16-chars!!";
    process.env.ONIZUKA_MEMORY_ENCRYPTION_KEY_PREVIOUS = "old-key-min-16-chars!";

    expect(decryptMemoryContent(content, true)).toBe("legacy secret");
  });
});
