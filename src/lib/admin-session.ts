import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole, isFullAdmin } from "@/lib/auth-roles";

export async function requireAdminArea() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) redirect("/login");
  return session;
}

export async function requireFullAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !isFullAdmin(session.user.role)) redirect("/login");
  return session;
}
