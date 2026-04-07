import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  const res = await fetch(`${API_BASE_URL}/api/v1/class-schedules`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return NextResponse.json(
      { message: "Failed to fetch class schedules" },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/api/v1/class-schedules`, {
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
      { message: data?.message ?? "Failed to create class schedule" },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}
