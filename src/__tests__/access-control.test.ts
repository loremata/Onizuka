/**
 * Access control tests: tenant isolation and role enforcement.
 * Mocks getServerSession and prisma to assert client cannot act on another client's post.
 */

import { approvePost, requestChanges } from "@/app/app/actions";

const mockSessionClientA = {
  user: {
    id: "user-a",
    email: "client@a.com",
    role: "CLIENT" as const,
    clientId: "client-a",
    timeZone: null as string | null,
  },
};

const mockSessionClientB = {
  user: {
    id: "user-b",
    email: "client@b.com",
    role: "CLIENT" as const,
    clientId: "client-b",
    timeZone: null as string | null,
  },
};

const mockPostForClientB = {
  id: "post-b",
  clientId: "client-b",
  platform: "FACEBOOK" as const,
  captionText: "Caption",
  status: "PENDING" as const,
  client: { companyName: "Client B Co" },
};

const postFindArgs = {
  include: { client: { select: { companyName: true } } },
};

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    postItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    comment: {
      create: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(() => Promise.resolve({ id: "audit-1" })),
    },
    $transaction: jest.fn((promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/webhook", () => ({
  notifyStatusChange: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/user-notifications", () => ({
  notifyAdminUsers: jest.fn(() => Promise.resolve()),
}));

const { getServerSession } = require("next-auth");
const { prisma } = require("@/lib/prisma");

describe("Access control: client actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("approvePost returns error when post belongs to another client", async () => {
    getServerSession.mockResolvedValue(mockSessionClientA);
    prisma.postItem.findFirst.mockResolvedValue(null); // post-b not found for client-a

    const formData = new FormData();
    formData.set("comment", "");
    const result = await approvePost("post-b", null, formData);

    expect(result).toEqual({ error: "Post non trovato." });
    expect(prisma.postItem.findFirst).toHaveBeenCalledWith({
      where: { id: "post-b", clientId: "client-a" },
      ...postFindArgs,
    });
    expect(prisma.postItem.update).not.toHaveBeenCalled();
  });

  it("approvePost succeeds when post belongs to current client", async () => {
    getServerSession.mockResolvedValue(mockSessionClientB);
    prisma.postItem.findFirst.mockResolvedValue(mockPostForClientB);
    prisma.postItem.update.mockResolvedValue({});
    prisma.comment.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((promises: Promise<unknown>[]) => Promise.all(promises));

    const formData = new FormData();
    const result = await approvePost("post-b", null, formData);

    expect(result).toBeNull();
    expect(prisma.postItem.findFirst).toHaveBeenCalledWith({
      where: { id: "post-b", clientId: "client-b" },
      ...postFindArgs,
    });
    expect(prisma.postItem.update).toHaveBeenCalled();
  });

  it("requestChanges returns error when post belongs to another client", async () => {
    getServerSession.mockResolvedValue(mockSessionClientA);
    prisma.postItem.findFirst.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("comment", "Please change this");
    const result = await requestChanges("post-b", null, formData);

    expect(result).toEqual({ error: "Post non trovato." });
    expect(prisma.postItem.update).not.toHaveBeenCalled();
  });

  it("requestChanges redirects to login when unauthorized (no session)", async () => {
    getServerSession.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("comment", "Please change this");
    await expect(requestChanges("post-b", null, formData)).rejects.toMatchObject({
      message: "NEXT_REDIRECT",
    });
    expect(prisma.postItem.findFirst).not.toHaveBeenCalled();
  });

  it("requestChanges returns error when comment is empty", async () => {
    getServerSession.mockResolvedValue(mockSessionClientB);
    prisma.postItem.findFirst.mockResolvedValue(mockPostForClientB);

    const formData = new FormData();
    formData.set("comment", "   ");
    const result = await requestChanges("post-b", null, formData);

    expect(result).toEqual({
      error: "Aggiungi un commento che spieghi quali modifiche servono.",
    });
    expect(prisma.postItem.update).not.toHaveBeenCalled();
  });
});
