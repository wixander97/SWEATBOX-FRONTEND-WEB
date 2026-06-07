import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/members/filter/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const backendUrl = new URL(`${API_BASE_URL}/api/v1/members/filter`);

  const forwardParams = [
    "Keyword", "MembershipStatus", "PaymentStatus", "MembershipType",
    "HomeClub", "MembershipSource", "IsPtMember", "IsActive",
    "ExpiringBefore", "JoinedAfter", "PageNumber", "PageSize",
  ];
  for (const param of forwardParams) {
    const val = searchParams.get(param) ?? searchParams.get(param.toLowerCase());
    if (val) backendUrl.searchParams.set(param, val);
  }

  console.log(`[API/v1/members/filter/GET] Fetching: ${backendUrl.toString()}`);

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    console.log(`[API/v1/members/filter/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: "Failed to filter members" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/members/filter/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}