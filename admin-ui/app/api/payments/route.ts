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
  const status = url.searchParams.get("status") ?? "";

  let backendPath = "/api/v1/payments";
  if (status === "paid") backendPath = "/api/v1/payments/paid";
  else if (status === "pending") backendPath = "/api/v1/payments/pending";
  else if (status === "failed") backendPath = "/api/v1/payments/failed";

  const res = await fetch(`${API_BASE_URL}${backendPath}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return NextResponse.json({ message: "Failed to fetch payments" }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/api/v1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message ?? "Failed to create payment" }, { status: res.status });
  }
  return NextResponse.json(data);
}
