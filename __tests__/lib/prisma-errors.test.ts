import { Prisma } from "@prisma/client";
import { isPrismaMissingTable } from "@/lib/prisma-errors";

describe("isPrismaMissingTable", () => {
  it("detects P2021 for Asset", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Table does not exist", {
      code: "P2021",
      clientVersion: "5.22.0",
      meta: { table: "public.Asset" },
    });
    expect(isPrismaMissingTable(error, "Asset")).toBe(true);
  });

  it("detects message containing Asset", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'The table `public.Asset` does not exist in the current database.',
      { code: "P2021", clientVersion: "5.22.0" }
    );
    expect(isPrismaMissingTable(error, "Asset")).toBe(true);
  });
});
