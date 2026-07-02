import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    // Use self.atob for Edge Runtime compatibility
    const json = self.atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload) return true;
  const exp = payload.exp;
  if (typeof exp !== "number") return false;
  return Date.now() >= exp * 1000;
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const headerToken = req.headers.get("X-Sb-Token");
  const { pathname } = req.nextUrl;

  const isAdminPath = pathname.startsWith("/admin");
  const isAuthPath = pathname === "/login";

  // Primary check: cookie token
  const hasToken = Boolean(token);
  const validToken = hasToken && !isTokenExpired(token ?? "");

  // Fallback: header token (from client localStorage)
  const hasValidHeaderToken =
    !validToken && Boolean(headerToken) && !isTokenExpired(headerToken ?? "");

  if (isAdminPath && !validToken && !hasValidHeaderToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    if (hasToken) {
      response.cookies.delete(AUTH_COOKIE_NAME);
    }
    return response;
  }

  if (isAuthPath && (validToken || hasValidHeaderToken)) {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  if (isAuthPath && hasToken && !validToken) {
    const response = NextResponse.next();
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};