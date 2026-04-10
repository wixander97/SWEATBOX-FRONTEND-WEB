import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function GET(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const keyword = url.searchParams.get("keyword") ?? "";

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/members/search`);
  if (keyword) backendUrl.searchParams.set("keyword", keyword);

  const res = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);

  if (!res.ok) {
    return NextResponse.json(
      { message: "Failed to search members" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}
