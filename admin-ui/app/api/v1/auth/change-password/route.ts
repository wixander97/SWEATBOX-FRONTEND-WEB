import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { setAuthTokenCookie } from "@/lib/auth/token";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function PUT(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/auth/change-password/PUT] Unauthorized - no token");
    return unauthorized();
  }

  const body = await request.json().catch(() => ({}));
  console.log("[API/v1/auth/change-password/PUT] Payload:", body);

  const url = `${API_BASE_URL}/api/v1/auth/change-password`;
  console.log(`[API/v1/auth/change-password/PUT] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/auth/change-password/PUT] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to change password" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/auth/change-password/PUT] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}