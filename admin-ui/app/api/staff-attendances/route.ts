import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function GET(req: Request) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const paged = url.searchParams.get("paged") === "true";

  if (paged) {
    const page = url.searchParams.get("page") ?? "1";
    const pageSize = url.searchParams.get("pageSize") ?? "10";
    const staffId = url.searchParams.get("staffId") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const branchName = url.searchParams.get("branchName") ?? "";
    const startDate = url.searchParams.get("startDate") ?? "";
    const endDate = url.searchParams.get("endDate") ?? "";

    const backendUrl = new URL(`${API_BASE_URL}/api/v1/staff-attendances/paged`);
    backendUrl.searchParams.set("page", page);
    backendUrl.searchParams.set("pageSize", pageSize);
    if (staffId) backendUrl.searchParams.set("staffId", staffId);
    if (status) backendUrl.searchParams.set("status", status);
    if (branchName) backendUrl.searchParams.set("branchName", branchName);
    if (startDate) backendUrl.searchParams.set("startDate", startDate);
    if (endDate) backendUrl.searchParams.set("endDate", endDate);

    const res = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) return NextResponse.json({ message: "Failed to fetch attendances" }, { status: res.status });
    return NextResponse.json(data);
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/staff-attendances`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);

  if (!res.ok) {
    return NextResponse.json(
      { message: "Failed to fetch staff attendances" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}
