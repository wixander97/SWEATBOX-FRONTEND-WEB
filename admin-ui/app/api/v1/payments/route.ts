import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/payments/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  // Accept either query param ?status=paid or direct path /paid
  const pathSegment = request.nextUrl.pathname.replace(/^.*\/payments\/?/, "");
  const statusKey = pathSegment || status;

  let backendPath = "/api/v1/payments";
  if (statusKey === "paid") backendPath = "/api/v1/payments/paid";
  else if (statusKey === "pending") backendPath = "/api/v1/payments/pending";
  else if (statusKey === "failed") backendPath = "/api/v1/payments/failed";

  const url = `${API_BASE_URL}${backendPath}`;
  console.log(`[API/v1/payments/GET] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    console.log(`[API/v1/payments/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: "Failed to fetch payments" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/payments/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/payments/POST] Unauthorized - no token");
    return unauthorized();
  }

  const body = await request.json().catch(() => ({}));
  console.log("[API/v1/payments/POST] Payload:", body);

  const url = `${API_BASE_URL}/api/v1/payments`;
  console.log(`[API/v1/payments/POST] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/payments/POST] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to create payment" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/payments/POST] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}