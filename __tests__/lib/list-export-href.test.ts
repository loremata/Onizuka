import { buildListExportHref } from "@/lib/list-export-href";

describe("list-export-href", () => {
  it("omits empty params", () => {
    expect(buildListExportHref("/api/export", { q: "", status: undefined })).toBe("/api/export");
  });

  it("encodes active filters", () => {
    expect(
      buildListExportHref("/api/export", { q: "acme", status: "NEW", maskSensitive: "1" })
    ).toBe("/api/export?q=acme&status=NEW&maskSensitive=1");
  });
});
