import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { setAuthTokenCookie, clearAuthTokenCookie } from "@/lib/auth/token";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function POST(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/auth/logout/POST] No token to logout");
    return NextResponse.json({ ok: true });
  }

  const url = `${API_BASE_URL}/api/v1/auth/logout`;
  console.log(`[API/v1/auth/logout/POST] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/auth/logout/POST] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    // Always clear cookie regardless of API response
    await clearAuthTokenCookie();

    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/auth/logout/POST] Network error:", err);
    // Still clear cookie on network error
    await clearAuthTokenCookie();
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}