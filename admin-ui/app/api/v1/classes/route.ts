import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/classes/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("pageSize") ?? "10";
  const search = searchParams.get("search") ?? "";
  const isActive = searchParams.get("isActive") ?? "";

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/class-schedules/paged`);
  backendUrl.searchParams.set("page", page);
  backendUrl.searchParams.set("pageSize", pageSize);
  if (search) backendUrl.searchParams.set("search", search);
  if (isActive) backendUrl.searchParams.set("isActive", isActive);

  console.log(`[API/v1/classes/GET] Fetching: ${backendUrl.toString()}`);

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    console.log(`[API/v1/classes/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: "Failed to fetch class schedules" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/classes/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/classes/POST] Unauthorized - no token");
    return unauthorized();
  }

  const body = await request.json().catch(() => ({}));
  console.log("[API/v1/classes/POST] Payload:", body);

  const url = `${API_BASE_URL}/api/v1/class-schedules`;
  console.log(`[API/v1/classes/POST] Sending to: ${url}`);

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
    console.log(`[API/v1/classes/POST] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to create class schedule" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/classes/POST] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}