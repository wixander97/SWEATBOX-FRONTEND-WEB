import { NextResponse } from "next/server";
import { clearAuthTokenCookie } from "@/lib/auth/token";

/**
 * Logout clears the session cookie; that is the whole of it.
 *
 * The SWEATBOX API has no logout endpoint, so the call this route used to
 * forward to `/api/v1/auth/logout` always failed and the cookie was cleared
 * regardless. It now does the same as `/api/auth/logout`.
 */
export async function POST() {
  await clearAuthTokenCookie();
  return NextResponse.json({ ok: true });
}
