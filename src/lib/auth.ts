import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { logLoginFailed } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      clientId: string | null;
      timeZone: string | null;
      mustChangePassword: boolean;
      staffAllowedModules: string[];
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
    clientId: string | null;
    timeZone: string | null;
    mustChangePassword: boolean;
    staffAllowedModules: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    clientId: string | null;
    mustChangePassword?: boolean;
    staffAllowedModules?: string[];
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(process.env.AZURE_AD_CLIENT_ID?.trim() && process.env.AZURE_AD_CLIENT_SECRET?.trim()
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID!.trim(),
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!.trim(),
            tenantId: process.env.AZURE_AD_TENANT_ID?.trim() || "common",
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            clientId: true,
            timeZone: true,
            mustChangePassword: true,
            staffAllowedModules: true,
          },
        });

        if (!user || !user.passwordHash) {
          if (process.env.PLAYWRIGHT_E2E === "1") {
            console.warn("[e2e-auth] user missing or passwordHash absent", credentials.email);
          }
          void logLoginFailed(credentials.email);
          return null;
        }

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) {
          if (process.env.PLAYWRIGHT_E2E === "1") {
            console.warn("[e2e-auth] invalid password", credentials.email);
          }
          void logLoginFailed(credentials.email);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId,
          timeZone: user.timeZone,
          mustChangePassword: user.mustChangePassword,
          staffAllowedModules: user.staffAllowedModules ?? [],
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "azure-ad" && user?.email) {
        const row = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, role: true },
        });
        if (!row || (row.role !== "ADMIN" && row.role !== "STAFF")) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "azure-ad" && user?.email) {
        const row = await prisma.user.findUnique({
          where: { email: user.email },
          select: {
            id: true,
            role: true,
            clientId: true,
            timeZone: true,
            mustChangePassword: true,
            staffAllowedModules: true,
            name: true,
          },
        });
        if (row) {
          token.id = row.id;
          token.role = row.role;
          token.clientId = row.clientId;
          token.mustChangePassword = row.mustChangePassword;
          token.staffAllowedModules = row.staffAllowedModules ?? [];
        }
      }
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clientId = user.clientId;
        token.mustChangePassword = user.mustChangePassword;
        token.staffAllowedModules = user.staffAllowedModules ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
        session.user.clientId = (token.clientId as string | null | undefined) ?? null;
        try {
          const row = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { timeZone: true, mustChangePassword: true, staffAllowedModules: true },
          });
          session.user.timeZone = row?.timeZone ?? null;
          session.user.mustChangePassword = row?.mustChangePassword ?? false;
          session.user.staffAllowedModules = row?.staffAllowedModules ?? [];
        } catch {
          session.user.timeZone = null;
          session.user.mustChangePassword = Boolean(token.mustChangePassword);
          session.user.staffAllowedModules = token.staffAllowedModules ?? [];
        }
      }
      return session;
    },
  },
};
