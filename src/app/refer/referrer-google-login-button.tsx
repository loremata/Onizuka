import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isReferrerGoogleOAuthConfigured } from "@/lib/referrer-google-oauth";

export function ReferrerGoogleLoginButton({ token }: { token: string }) {
  if (!isReferrerGoogleOAuthConfigured()) return null;

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-xs text-muted-foreground">Oppure accedi con Google (email già registrata sul segnalatore).</p>
      <Button asChild variant="outline" className="w-full">
        <Link href={`/api/refer/oauth/google?t=${encodeURIComponent(token)}`}>Continua con Google</Link>
      </Button>
    </div>
  );
}
