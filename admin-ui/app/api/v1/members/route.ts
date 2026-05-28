import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/members/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? searchParams.get("pageNumber") ?? "1";
  const pageSize = searchParams.get("pageSize") ?? "10";
  const search = searchParams.get("search") ?? searchParams.get("keyword") ?? "";
  const isActiveQuery = searchParams.get("isActive");
  const membershipStatus = searchParams.get("membershipStatus") ?? "";
  const isActive = isActiveQuery ?? (
    membershipStatus.toLowerCase() === "active" ? "true" : membershipStatus ? "false" : ""
  );

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/members/paged`);
  backendUrl.searchParams.set("page", page);
  backendUrl.searchParams.set("pageSize", pageSize);
  if (search) backendUrl.searchParams.set("search", search);
  if (isActive) backendUrl.searchParams.set("isActive", isActive);

  console.log(`[API/v1/members/GET] Fetching: ${backendUrl.toString()}`);

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    console.log(`[API/v1/members/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: "Failed to fetch members" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/members/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/members/POST] Unauthorized - no token");
    return unauthorized();
  }

  const body = await request.json().catch(() => ({}));
  console.log("[API/v1/members/POST] Payload:", body);

  const url = `${API_BASE_URL}/api/v1/members`;
  console.log(`[API/v1/members/POST] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/members/POST] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to create member", details: data }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/members/POST] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}