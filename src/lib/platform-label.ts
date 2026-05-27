import type { Platform } from "@prisma/client";

export const platformLabel: Record<Platform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  GBP: "Google Business Profile",
};

export const platformOptions: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "GBP"];
