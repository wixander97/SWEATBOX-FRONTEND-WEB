import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function GET(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const backendUrl = new URL(`${API_BASE_URL}/api/v1/members/filter`);

  const forwardParams = [
    "Keyword", "MembershipStatus", "PaymentStatus", "MembershipType",
    "HomeClub", "MembershipSource", "IsPtMember", "IsActive",
    "ExpiringBefore", "JoinedAfter", "PageNumber", "PageSize",
  ];
  for (const param of forwardParams) {
    const val = url.searchParams.get(param) ?? url.searchParams.get(param.toLowerCase());
    if (val) backendUrl.searchParams.set(param, val);
  }

  const res = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return NextResponse.json({ message: "Failed to filter members" }, { status: res.status });
  }
  return NextResponse.json(data);
}
