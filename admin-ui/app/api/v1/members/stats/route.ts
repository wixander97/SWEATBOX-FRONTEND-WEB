import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/members/stats/GET] Unauthorized - no token");
    return unauthorized();
  }

  const url = `${API_BASE_URL}/api/v1/members/stats`;
  console.log(`[API/v1/members/stats/GET] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/members/stats/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: "Failed to fetch member stats" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/members/stats/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}