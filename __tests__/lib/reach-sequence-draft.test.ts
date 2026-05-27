import { buildOutreachDraftFromSequenceStep } from "@/lib/reach-sequence-draft";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    outreachDraft: { findFirst: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("@/lib/prisma") as {
  prisma: {
    user: { findUnique: jest.Mock };
    outreachDraft: { findFirst: jest.Mock };
  };
};

describe("buildOutreachDraftFromSequenceStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ reachAbDefaultVariant: "B" });
    prisma.outreachDraft.findFirst.mockResolvedValue(null);
  });

  it("uses variant B for preview when default is B", async () => {
    const result = await buildOutreachDraftFromSequenceStep("u1", {
      subject: "Subject A",
      subjectAlt: "Subject B",
      body: "Body A",
      bodyAlt: "Body B",
    });
    expect(result.variant).toBe("B");
    expect(result.previewSubject).toBe("Subject B");
    expect(result.previewBody).toBe("Body B");
  });

  it("keeps full A/B fields on draft", async () => {
    const result = await buildOutreachDraftFromSequenceStep("u1", {
      subject: "A",
      subjectAlt: "B",
      body: "bodyA",
      bodyAlt: "bodyB",
    });
    expect(result.draftFields.subjectAlt).toBe("B");
    expect(result.draftFields.bodyAlt).toBe("bodyB");
  });
});
