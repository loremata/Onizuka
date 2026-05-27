import type { OpportunityPriority, OpportunityStatus } from "@prisma/client";

export const opportunityStatusLabel: Record<OpportunityStatus, string> = {
  OPEN: "Aperta",
  WON: "Vinta",
  LOST: "Persa",
  PAUSED: "In pausa",
};

export const opportunityStatusOptions: OpportunityStatus[] = ["OPEN", "WON", "LOST", "PAUSED"];

export const opportunityPriorityLabel: Record<OpportunityPriority, string> = {
  LOW: "Bassa",
  MEDIUM: "Media",
  HIGH: "Alta",
};

export const opportunityPriorityOptions: OpportunityPriority[] = ["LOW", "MEDIUM", "HIGH"];
