import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminAreaRole, isFullAdmin } from "@/lib/auth-roles";
import { staffCanAccessPath } from "@/lib/staff-permissions";

export async function getAdminApiSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session || !isAdminAreaRole(session.user.role)) return null;
  return session;
}

export async function requireAdminApiSession(pathname: string): Promise<Session | NextResponse> {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  if (!staffCanAccessPath(session.user.role, pathname)) {
    return NextResponse.json({ error: "Permesso negato per il ruolo STAFF" }, { status: 403 });
  }
  return session;
}

export async function requireFullAdminApiSession(): Promise<Session | NextResponse> {
  const session = await getAdminApiSession();
  if (!session || !isFullAdmin(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  return session;
}
