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
  const page = url.searchParams.get("page") ?? "1";
  const pageSize = url.searchParams.get("pageSize") ?? "10";
  const search = url.searchParams.get("search") ?? "";
  const isActive = url.searchParams.get("isActive") ?? "";
  const roleId = url.searchParams.get("roleId") ?? "";

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/users/paged`);
  backendUrl.searchParams.set("page", page);
  backendUrl.searchParams.set("pageSize", pageSize);
  if (search) backendUrl.searchParams.set("search", search);
  if (isActive) backendUrl.searchParams.set("isActive", isActive);
  if (roleId) backendUrl.searchParams.set("roleId", roleId);

  const res = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return NextResponse.json({ message: "Failed to fetch users" }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/api/v1/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message ?? "Failed to create user" }, { status: res.status });
  }
  return NextResponse.json(data);
}
