import { parseVoiceTranscript } from "@/lib/voice-intent";

describe("parseVoiceTranscript", () => {
  it("creates task from ricordami pattern", () => {
    const r = parseVoiceTranscript("Onizuka, ricordami di chiamare CP Racing domani");
    expect(r.kind).toBe("task");
    if (r.kind === "task") expect(r.title.toLowerCase()).toContain("chiamare");
  });

  it("navigates to search for apri cliente", () => {
    const r = parseVoiceTranscript("apri cliente Demo Client");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.href).toContain("/admin/search");
  });

  it("routes audit commands", () => {
    const r = parseVoiceTranscript("avvia audit partita iva");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.href).toBe("/admin/audit/digital");
  });

  it("routes reach sequences", () => {
    const r = parseVoiceTranscript("Onizuka, apri sequenze reach");
    expect(r.kind).toBe("navigate");
    if (r.kind === "navigate") expect(r.href).toBe("/admin/reach/sequences");
  });

  it("captures memory intent", () => {
    const r = parseVoiceTranscript("memorizza il cliente preferisce WhatsApp");
    expect(r.kind).toBe("memory");
    if (r.kind === "memory") expect(r.content).toContain("WhatsApp");
  });

  it("parses complete task intent", () => {
    const r = parseVoiceTranscript("completa task chiamare CP Racing");
    expect(r.kind).toBe("completeTask");
    if (r.kind === "completeTask") expect(r.query).toContain("chiamare");
  });
});
