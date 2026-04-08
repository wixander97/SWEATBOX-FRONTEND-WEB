import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  const url = new URL(req.url);
  const keyword = url.searchParams.get("keyword") ?? "";
  const membershipStatus = url.searchParams.get("membershipStatus") ?? "";
  const paymentStatus = url.searchParams.get("paymentStatus") ?? "";
  const membershipType = url.searchParams.get("membershipType") ?? "";
  const homeClub = url.searchParams.get("homeClub") ?? "";
  const pageNumber = url.searchParams.get("pageNumber") ?? "1";
  const pageSize = url.searchParams.get("pageSize") ?? "50";

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/members/filter`);
  if (keyword) backendUrl.searchParams.set("Keyword", keyword);
  if (membershipStatus) {
    backendUrl.searchParams.set("MembershipStatus", membershipStatus);
  }
  if (paymentStatus) backendUrl.searchParams.set("PaymentStatus", paymentStatus);
  if (membershipType) backendUrl.searchParams.set("MembershipType", membershipType);
  if (homeClub) backendUrl.searchParams.set("HomeClub", homeClub);
  backendUrl.searchParams.set("PageNumber", pageNumber);
  backendUrl.searchParams.set("PageSize", pageSize);

  const res = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);

  if (!res.ok) {
    return NextResponse.json(
      { message: "Failed to fetch members" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();
  const body = await req.json();

  const res = await fetch(`${API_BASE_URL}/api/v1/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { message: data?.message ?? "Failed to create member" },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}
