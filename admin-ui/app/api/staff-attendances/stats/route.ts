import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function GET(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/staff-attendances/stats`);
  if (date) backendUrl.searchParams.set("date", date);

  const res = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: "Failed to fetch attendance stats" }, { status: res.status });
  }
  return NextResponse.json(data);
}
