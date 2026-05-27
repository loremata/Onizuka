import type { Platform, PostStatus } from "@prisma/client";

/** Nomi piattaforma mostrati in UI (prodotto Google in forma standard). */
export const platformLabelIt: Record<Platform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  GBP: "Google Business Profile",
};

export const postStatusLabelIt: Record<PostStatus, string> = {
  PENDING: "In attesa",
  APPROVED: "Approvato",
  NEEDS_REVISION: "Richiede modifiche",
};

const PLATFORMS_ORDER: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "GBP"];
const POST_STATUSES_ORDER: PostStatus[] = ["PENDING", "APPROVED", "NEEDS_REVISION"];

export function platformSelectRows(): { value: Platform; label: string }[] {
  return PLATFORMS_ORDER.map((value) => ({ value, label: platformLabelIt[value] }));
}

export function postStatusSelectRows(): { value: PostStatus; label: string }[] {
  return POST_STATUSES_ORDER.map((value) => ({ value, label: postStatusLabelIt[value] }));
}
