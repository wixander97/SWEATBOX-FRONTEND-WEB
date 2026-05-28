import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/users/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("pageSize") ?? "10";
  const search = searchParams.get("search") ?? "";

  const params = new URLSearchParams({ page, pageSize });
  if (search) params.set("search", search);

  const url = `${API_BASE_URL}/api/v1/users?${params.toString()}`;
  console.log(`[API/v1/users/GET] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/users/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message ?? "Failed to fetch users" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/users/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/users/POST] Unauthorized - no token");
    return unauthorized();
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
    console.log(`[API/v1/users/POST] Payload:`, body);
  } catch {
    console.error("[API/v1/users/POST] Failed to parse body");
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const url = `${API_BASE_URL}/api/v1/users`;
  console.log(`[API/v1/users/POST] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/users/POST] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message ?? "Failed to create user" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/users/POST] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}