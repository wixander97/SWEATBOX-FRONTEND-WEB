import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { setAuthTokenCookie, setRefreshTokenCookie } from "@/lib/auth/token";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  console.log("[API/v1/auth/login/POST] Payload:", { email: body.email, password: "***" });

  if (!body.email || !body.password) {
    return NextResponse.json({ message: "Email dan password wajib diisi" }, { status: 400 });
  }

  const url = `${API_BASE_URL}/api/v1/auth/login`;
  console.log(`[API/v1/auth/login/POST] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/auth/login/POST] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Login failed" }, { status: res.status });
    }

    // Set auth token cookie
    if (data.token) {
      await setAuthTokenCookie(data.token);
    }

    // Set refresh token cookie if provided
    if (data.refreshToken) {
      await setRefreshTokenCookie(data.refreshToken);
    }

    // Return user data along with success
    return NextResponse.json({
      ok: true,
      fullName: data.fullName,
      email: data.email,
      role: data.role,
    });
  } catch (err) {
    console.error("[API/v1/auth/login/POST] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}