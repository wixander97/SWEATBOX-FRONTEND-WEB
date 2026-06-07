import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/staff-attendances/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const paged = searchParams.get("paged") === "true";

  if (paged) {
    const page = searchParams.get("page") ?? "1";
    const pageSize = searchParams.get("pageSize") ?? "10";
    const staffId = searchParams.get("staffId") ?? "";
    const status = searchParams.get("status") ?? "";
    const branchName = searchParams.get("branchName") ?? "";
    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";

    const backendUrl = new URL(`${API_BASE_URL}/api/v1/staff-attendances/paged`);
    backendUrl.searchParams.set("page", page);
    backendUrl.searchParams.set("pageSize", pageSize);
    if (staffId) backendUrl.searchParams.set("staffId", staffId);
    if (status) backendUrl.searchParams.set("status", status);
    if (branchName) backendUrl.searchParams.set("branchName", branchName);
    if (startDate) backendUrl.searchParams.set("startDate", startDate);
    if (endDate) backendUrl.searchParams.set("endDate", endDate);

    console.log(`[API/v1/staff-attendances/GET] Fetching paged: ${backendUrl.toString()}`);

    try {
      const res = await fetch(backendUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const data = await res.json().catch(() => []);
      console.log(`[API/v1/staff-attendances/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

      if (!res.ok) {
        return NextResponse.json({ message: "Failed to fetch attendances" }, { status: res.status });
      }
      return NextResponse.json(data);
    } catch (err) {
      console.error("[API/v1/staff-attendances/GET] Network error:", err);
      return NextResponse.json({ message: "Network error" }, { status: 500 });
    }
  }

  const url = `${API_BASE_URL}/api/v1/staff-attendances`;
  console.log(`[API/v1/staff-attendances/GET] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    console.log(`[API/v1/staff-attendances/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: "Failed to fetch staff attendances" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/staff-attendances/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}