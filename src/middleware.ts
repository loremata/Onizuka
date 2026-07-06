/**
 * Perimetro sessione (punto 1): `/login`, `/admin/*`, `/app/*` e POST verso sign-in/credentials.
 * `/api/n8n/*` non è nel matcher: resta fuori da NextAuth e usa solo `N8N_API_KEY` nelle route.
 */
import { withAuth } from "next-auth/middleware";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { ApiErrorCode } from "@/lib/api-json-errors";
import { isAdminAreaRole, isAdminOnlyPath } from "@/lib/auth-roles";
import { getClientPreviewFromRequest } from "@/lib/client-impersonation";
import { checkLoginRateLimit } from "@/lib/login-rate-limit";

function getIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}

const loginPaths = ["/api/auth/signin", "/api/auth/callback/credentials"];

function passwordChangePath(token: { role?: string }) {
  return isAdminAreaRole(token.role) ? "/admin/account/password" : "/app/account/password";
}

const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    /** NextAuth: non interferire con il flusso signIn/callback/CSRF. */
    if (path.startsWith("/api/auth/")) {
      return NextResponse.next();
    }

    /** Webhook Meta WhatsApp (verifica + eventi) senza sessione. */
    if (path === "/api/integrations/whatsapp/webhook") {
      return NextResponse.next();
    }

    /** Webhook Telegram Bot: nessuna sessione, autenticato dal secret_token nella route. */
    if (path === "/api/integrations/telegram") {
      return NextResponse.next();
    }

    /** Utente già autenticato: non mostrare di nuovo il form login. */
    if (path === "/login") {
      if (token) {
        const dest = passwordChangePath(token);
        if (token.mustChangePassword) {
          return NextResponse.redirect(new URL(dest, req.url));
        }
        return NextResponse.redirect(
          new URL(isAdminAreaRole(token.role) ? "/admin" : "/app", req.url)
        );
      }
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const changePath = passwordChangePath(token);
    if (token.mustChangePassword && path !== changePath) {
      return NextResponse.redirect(new URL(changePath, req.url));
    }

    if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
      if (!isAdminAreaRole(token.role)) {
        return NextResponse.redirect(new URL("/app", req.url));
      }
      if (
        token.role === "STAFF" &&
        isAdminOnlyPath(path, token.staffAllowedModules as string[] | undefined)
      ) {
        if (path.startsWith("/api/")) {
          return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.next();
    }

    if (path.startsWith("/api/integrations")) {
      if (!isAdminAreaRole(token.role)) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
      }
      if (
        token.role === "STAFF" &&
        isAdminOnlyPath(path, token.staffAllowedModules as string[] | undefined)
      ) {
        return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
      }
      return NextResponse.next();
    }

    if (path.startsWith("/app") || path.startsWith("/api/app")) {
      if (token.role !== "CLIENT") {
        const preview =
          isAdminAreaRole(token.role) && token.id
            ? getClientPreviewFromRequest(req)
            : null;
        if (preview && preview.adminUserId === token.id) {
          return NextResponse.next();
        }
        if (path.startsWith("/api/")) {
          return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      if (!token.clientId) {
        if (path.startsWith("/api/")) {
          return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/login", req.url));
      }
      return NextResponse.next();
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname;
        if (pathname.startsWith("/api/auth/")) return true;
        if (pathname === "/login") return true;
        // Webhook pubblici: autenticati dal proprio secret nella route, non dalla sessione.
        // Senza questa eccezione withAuth redirige a /api/auth/signin prima del corpo.
        if (pathname === "/api/integrations/whatsapp/webhook") return true;
        if (pathname === "/api/integrations/telegram") return true;
        return !!token;
      },
    },
  }
);

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const url = new URL(req.url);
  if (loginPaths.includes(url.pathname) && req.method === "POST") {
    if (process.env.PLAYWRIGHT_E2E === "1" || process.env.ONIZUKA_E2E === "1") {
      return NextResponse.next();
    }
    const ip = getIp(req);
    if (await checkLoginRateLimit(ip)) {
      return NextResponse.json(
        {
          error: "Troppi tentativi di accesso. Riprova più tardi.",
          code: ApiErrorCode.LOGIN_RATE_LIMIT,
        },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }
  return authMiddleware(req as Parameters<typeof authMiddleware>[0], event);
}

export const config = {
  matcher: [
    "/login",
    "/admin/:path*",
    "/app/:path*",
    "/api/admin/:path*",
    "/api/app/:path*",
    "/api/integrations/:path*",
    "/api/auth/signin",
    "/api/auth/callback/credentials",
  ],
};
