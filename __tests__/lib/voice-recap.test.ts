import { buildVoiceRecapText } from "@/lib/voice-recap";

describe("buildVoiceRecapText", () => {
  it("includes key metrics", () => {
    const text = buildVoiceRecapText(
      {
        pendingPosts: 2,
        flowOpen: 3,
        clientsCount: 5,
        memoryCount: 1,
        tasksDueToday: [],
        tasksOverdue: 1,
        urgentOpen: 0,
        recentMemories: [],
        dormantClients: 0,
        opportunitiesOpen: 4,
      },
      "Europe/Rome"
    );
    expect(text).toContain("Recap Onizuka");
    expect(text).toContain("2 post");
  });
});
