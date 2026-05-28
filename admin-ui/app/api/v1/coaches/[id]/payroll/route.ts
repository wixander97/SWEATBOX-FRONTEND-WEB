import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/coaches/[id]/payroll/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { id } = await params;
  const url = `${API_BASE_URL}/api/v1/coaches/${id}/payroll`;
  console.log(`[API/v1/coaches/[id]/payroll/GET] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    console.log(`[API/v1/coaches/[id]/payroll/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to fetch coach payroll" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/coaches/[id]/payroll/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}