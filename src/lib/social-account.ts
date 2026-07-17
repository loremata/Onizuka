import type { SocialAccount } from "@prisma/client";
import { decryptJson, encryptJson } from "@/lib/token-crypto";

/// Bundle token salvato cifrato in SocialAccount.tokenCipher.
export type SocialTokenBundle = {
  accessToken: string;
  refreshToken?: string;
};

/// Cifra il bundle token per lo storage (riusa token-crypto / NEXTAUTH_SECRET).
export function encryptSocialToken(bundle: SocialTokenBundle): string {
  return encryptJson(bundle);
}

/// Decifra il token dell'account. Null se assente o non decifrabile.
export function getSocialAccountToken(
  account: Pick<SocialAccount, "tokenCipher">
): SocialTokenBundle | null {
  if (!account.tokenCipher) return null;
  try {
    return decryptJson<SocialTokenBundle>(account.tokenCipher);
  } catch {
    return null;
  }
}
