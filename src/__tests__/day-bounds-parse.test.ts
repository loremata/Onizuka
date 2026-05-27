import { parseDateTimeLocalInIanaZone, resolveDueInputIanaZone } from "@/lib/day-bounds";

describe("parseDateTimeLocalInIanaZone", () => {
  it("round-trip: istante → stringa locale → stesso istante (Europe/Rome)", () => {
    const ref = new Date(Date.UTC(2024, 6, 15, 10, 30, 0, 0));
    const df = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      df.formatToParts(ref).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
    ) as Record<string, string>;
    const raw = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    const parsed = parseDateTimeLocalInIanaZone(raw, "Europe/Rome");
    expect(parsed).not.toBeNull();
    expect(parsed!.getTime()).toBe(ref.getTime());
  });
});

describe("resolveDueInputIanaZone", () => {
  const prev = process.env.ONIZUKA_RECAP_TIMEZONE;

  afterEach(() => {
    if (prev === undefined) delete process.env.ONIZUKA_RECAP_TIMEZONE;
    else process.env.ONIZUKA_RECAP_TIMEZONE = prev;
  });

  it("preferisce il profilo utente rispetto all'env", () => {
    process.env.ONIZUKA_RECAP_TIMEZONE = "America/New_York";
    expect(resolveDueInputIanaZone("Europe/Rome")).toBe("Europe/Rome");
  });

  it("usa l'env se il profilo è assente", () => {
    process.env.ONIZUKA_RECAP_TIMEZONE = "America/New_York";
    expect(resolveDueInputIanaZone(null)).toBe("America/New_York");
  });
});
