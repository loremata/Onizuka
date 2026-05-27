import { reindexMemoryEmbeddings } from "@/lib/memory-reindex";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/llm-client", () => ({
  isEmbeddingConfigured: jest.fn(() => false),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    memoryItem: {
      findMany: jest.fn(() => Promise.resolve([])),
    },
  },
}));

describe("reindexMemoryEmbeddings", () => {
  it("returns zero when embeddings disabled", async () => {
    const r = await reindexMemoryEmbeddings("user-1");
    expect(r).toEqual({ processed: 0, indexed: 0, skipped: 0 });
    expect(prisma.memoryItem.findMany).not.toHaveBeenCalled();
  });
});
