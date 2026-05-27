import { buildMailtoUrl } from "@/lib/mailto-outreach";

describe("buildMailtoUrl", () => {
  it("encodes subject and body", () => {
    const url = buildMailtoUrl({
      to: "a@example.com",
      subject: "Ciao",
      body: "Test\nriga 2",
    });
    expect(url).toMatch(/^mailto:/);
    expect(url).toContain("subject=");
    expect(url).toContain("body=");
  });
});
