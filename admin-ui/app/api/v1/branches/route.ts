import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  const res = await fetch(`${API_BASE_URL}/api/v1/branches`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return NextResponse.json(
      { message: data?.message ?? "Failed to fetch branches" },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}
