import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { API_BASE_URL } from "@/lib/auth/constants";

async function isTokenValid(token: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const { pathname } = req.nextUrl;

  const isAdminPath = pathname.startsWith("/admin");
  const isAuthPath = pathname === "/login" || pathname === "/register";
  const hasToken = Boolean(token);
  const validToken = token ? await isTokenValid(token) : false;

  if (isAdminPath && !validToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    if (hasToken) {
      response.cookies.delete(AUTH_COOKIE_NAME);
    }
    return response;
  }

  if (isAuthPath && validToken) {
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
  matcher: ["/admin/:path*", "/login", "/register"],
};
