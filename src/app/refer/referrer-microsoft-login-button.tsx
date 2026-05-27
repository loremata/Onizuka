import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isReferrerMicrosoftOAuthConfigured } from "@/lib/referrer-microsoft-oauth";

export function ReferrerMicrosoftLoginButton({ token }: { token: string }) {
  if (!isReferrerMicrosoftOAuthConfigured()) return null;

  return (
    <Button asChild variant="outline" className="w-full">
      <Link href={`/api/refer/oauth/microsoft?t=${encodeURIComponent(token)}`}>
        Continua con Microsoft
      </Link>
    </Button>
  );
}
