import { runAskWithMemory } from "@/lib/ask-with-memory";

jest.mock("@/lib/memory-rag", () => ({
  searchMemoryRag: jest.fn(() => Promise.resolve([])),
  formatMemoryRagContext: jest.fn(() => ""),
}));

jest.mock("@/lib/llm-client", () => ({
  isLlmConfigured: jest.fn(() => false),
  chatCompletion: jest.fn(),
}));

jest.mock("@/lib/ask-operational-context", () => ({
  buildAskOperationalContext: jest.fn(() => Promise.resolve("")),
}));

describe("ask-with-memory", () => {
  it("returns rules mode without LLM", async () => {
    const result = await runAskWithMemory("user-1", "pipeline");
    expect(result.mode).toBe("rules");
    expect(result.primaryHref).toContain("/admin/crm/pipeline");
    expect(result.answer.length).toBeGreaterThan(5);
  });
});
