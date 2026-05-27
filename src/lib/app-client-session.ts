import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole } from "@/lib/auth-roles";
import { getClientPreviewContext } from "@/lib/client-impersonation";

export type AppClientContext = {
  userId: string;
  email: string;
  clientId: string;
  isAdminPreview: boolean;
};

/** Contesto portale cliente: utente CLIENT o ADMIN in anteprima con cookie valido. */
export async function requireAppClientContext(): Promise<AppClientContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  if (session.user.role === "CLIENT") {
    if (!session.user.clientId) redirect("/login");
    return {
      userId: session.user.id,
      email: session.user.email,
      clientId: session.user.clientId,
      isAdminPreview: false,
    };
  }

  if (isAdminAreaRole(session.user.role)) {
    const preview = await getClientPreviewContext();
    if (preview && preview.adminUserId === session.user.id) {
      return {
        userId: session.user.id,
        email: session.user.email,
        clientId: preview.clientId,
        isAdminPreview: true,
      };
    }
  }

  redirect("/admin");
}
