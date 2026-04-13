import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getAuthTokenFromCookie();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const res = await fetch(`${API_BASE_URL}/api/v1/coaches/${id}/payroll-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message ?? "Failed to fetch payroll summary" }, { status: res.status });
  }
  return NextResponse.json(data);
}
