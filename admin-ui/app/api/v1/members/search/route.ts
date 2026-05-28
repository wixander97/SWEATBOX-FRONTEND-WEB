import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/members/search/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") ?? "";

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/members/search`);
  if (keyword) backendUrl.searchParams.set("keyword", keyword);

  console.log(`[API/v1/members/search/GET] Fetching: ${backendUrl.toString()}`);

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    console.log(`[API/v1/members/search/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: "Failed to search members" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/members/search/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}