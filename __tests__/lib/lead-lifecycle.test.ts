import {
  leadLifecycleForStage,
  representativeStageForStatus,
  statusForStage,
} from "@/lib/lead-lifecycle";
import { commercialProspectStageOptions } from "@/lib/commercial-prospect-stage";
import type { LeadStatus } from "@prisma/client";

describe("lead-lifecycle", () => {
  it("non considera contattato chi ha solo una bozza in attesa di approvazione", () => {
    // È il punto che faceva mentire il funnel: 496 lead "contattati" senza che
    // fosse partita una mail. Il contatto comincia quando la mail parte.
    expect(statusForStage("AWAITING_SEND_APPROVAL")).toBe("QUALIFIED");
    expect(statusForStage("FIRST_AUDIT_MAIL_SENT")).toBe("CONTACTED");
    expect(statusForStage("FOLLOW_UP_SENT")).toBe("CONTACTED");
  });

  it("mantiene il round-trip status → stadio rappresentativo → status", () => {
    const statuses: LeadStatus[] = ["NEW", "COLD", "QUALIFIED", "CONTACTED", "CONVERTED", "LOST"];
    for (const s of statuses) {
      expect(statusForStage(representativeStageForStatus(s))).toBe(s);
    }
  });

  it("copre tutti gli stadi del funnel", () => {
    for (const stage of commercialProspectStageOptions) {
      expect(leadLifecycleForStage(stage).status).toBeDefined();
    }
  });
});
