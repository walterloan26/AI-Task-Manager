// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ROLES } from "@/lib/roles";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // 🚫 Not authenticated
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 🚫 Disabled account
  if (!token.isActive) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 🔐 Admin-only routes
  if (
    pathname.startsWith("/admin") &&
    token.role !== ROLES.ADMIN
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 🔁 Prevent logged-in users from visiting /login or /register
  if (
    (pathname === "/login" || pathname === "/register") &&
    token
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

/* ======================================================
   Matcher
====================================================== */

export const config = {
  matcher: [
    /*
      Protect everything except:
      - static files
      - images
      - public assets
    */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
