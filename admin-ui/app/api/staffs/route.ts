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
  const paged = url.searchParams.get("paged") === "true";

  if (paged) {
    const page = url.searchParams.get("page") ?? "1";
    const pageSize = url.searchParams.get("pageSize") ?? "10";
    const search = url.searchParams.get("search") ?? "";
    const isActive = url.searchParams.get("isActive") ?? "";
    const branchName = url.searchParams.get("branchName") ?? "";
    const department = url.searchParams.get("department") ?? "";

    const backendUrl = new URL(`${API_BASE_URL}/api/v1/staffs/paged`);
    backendUrl.searchParams.set("page", page);
    backendUrl.searchParams.set("pageSize", pageSize);
    if (search) backendUrl.searchParams.set("search", search);
    if (isActive) backendUrl.searchParams.set("isActive", isActive);
    if (branchName) backendUrl.searchParams.set("branchName", branchName);
    if (department) backendUrl.searchParams.set("department", department);

    const res = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) return NextResponse.json({ message: "Failed to fetch staffs" }, { status: res.status });
    return NextResponse.json(data);
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/staffs`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    return NextResponse.json({ message: "Failed to fetch staffs" }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();

  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/api/v1/staffs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message ?? "Failed to create staff" }, { status: res.status });
  }
  return NextResponse.json(data);
}
