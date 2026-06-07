import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getRefreshTokenFromCookie, setAuthTokenCookie, setRefreshTokenCookie } from "@/lib/auth/token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const refreshToken = await getRefreshTokenFromCookie();
  if (!refreshToken) {
    console.warn("[API/v1/auth/refresh-token/POST] No refresh token in cookie");
    return unauthorized();
  }

  console.log("[API/v1/auth/refresh-token/POST] Attempting to refresh token");

  const url = `${API_BASE_URL}/api/v1/auth/refresh-token`;
  console.log(`[API/v1/auth/refresh-token/POST] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/auth/refresh-token/POST] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to refresh token" }, { status: res.status });
    }

    // Update both cookies with new values
    if (data.accessToken) {
      await setAuthTokenCookie(data.accessToken);
    }
    if (data.refreshToken) {
      await setRefreshTokenCookie(data.refreshToken);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API/v1/auth/refresh-token/POST] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}