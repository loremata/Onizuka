import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { checkLoginRateLimit } from "@/lib/login-rate-limit";

function getIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}

const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (path.startsWith("/admin")) {
      if (token.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/app", req.url));
      }
      return NextResponse.next();
    }

    if (path.startsWith("/app")) {
      if (token.role !== "CLIENT") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      if (!token.clientId) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
      return NextResponse.next();
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

const loginPaths = ["/api/auth/signin", "/api/auth/callback/credentials"];

export default function middleware(req: Request) {
  const url = new URL(req.url);
  if (loginPaths.includes(url.pathname) && req.method === "POST") {
    const ip = getIp(req);
    if (checkLoginRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }
  return authMiddleware(req);
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*", "/api/auth/signin", "/api/auth/callback/credentials"],
};
